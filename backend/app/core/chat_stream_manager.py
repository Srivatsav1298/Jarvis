"""ChatStreamManager — runs per-request streaming tasks and cancellation.

Each task: prepares a conversation turn (context + history + system prompt),
streams tokens from the resolved AI provider, and emits the exact WS contract:
chat.started → ai.thinking → chat.chunk* → chat.end.
"""
import asyncio
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any

from app.ai.conversation.conversation_manager import ConversationManager
from app.ai.providers.base import ChatMessage
from app.ai.providers.fallback import FallbackProvider
from app.ai.registry import AIManager
from app.ai.tools.factory import build_tool_registry
from app.ai.tools.runner import complete_with_tools
from app.config.settings import Settings
from app.repositories.implementations import (
    ConversationRepository,
    MessageRepository,
)
from app.schemas.chat import ChatAccepted, ChatRequest
from app.websocket.events import (
    AI_THINKING,
    CHAT_CANCELLED,
    CHAT_CHUNK,
    CHAT_END,
    CHAT_START,
)

Broadcaster = Callable[[str, dict], Awaitable[None]]
SessionFactory = Callable[[], Awaitable[Any]]
ConversationFactory = Callable[[Any], ConversationManager]


class ChatStreamManager:
    """Owns streaming chat tasks; each task uses a fresh DB session."""

    def __init__(
        self,
        session_factory: SessionFactory,
        settings: Settings,
        broadcaster: Broadcaster,
        *,
        ai_manager: AIManager | None = None,
        conversation_factory: ConversationFactory | None = None,
    ) -> None:
        self._session_factory = session_factory
        self.settings = settings
        self.broadcaster = broadcaster
        self._ai_manager = ai_manager or AIManager(
            FallbackProvider(), settings.ai_provider
        )
        self._conversation_factory = conversation_factory
        self._tasks: dict[str, asyncio.Task] = {}
        self._conversation_ids: dict[str, str] = {}

    async def start(self, request: ChatRequest) -> ChatAccepted:
        """Persist the user turn, spawn a streaming task, return an ack."""
        if request.request_id in self._tasks:
            return ChatAccepted(
                request_id=request.request_id,
                conversation_id=self._conversation_ids[request.request_id],
                model=self.settings.ai_model,
            )

        async with self._session_factory() as session:
            conversations = ConversationRepository(session)
            messages = MessageRepository(session)
            conversation_id = request.conversation_id
            if conversation_id is None:
                conversation = await conversations.create(
                    {"title": request.message[:60]}
                )
                conversation_id = conversation.id
            else:
                if await conversations.get(conversation_id) is None:
                    await conversations.create(
                        {
                            "id": conversation_id,
                            "title": request.message[:60],
                        }
                    )
            await messages.create(
                {
                    "conversation_id": conversation_id,
                    "role": "user",
                    "content": request.message,
                }
            )

        self._conversation_ids[request.request_id] = conversation_id
        task = asyncio.create_task(
            self._run(request.request_id, conversation_id, request.message)
        )
        self._tasks[request.request_id] = task
        return ChatAccepted(
            request_id=request.request_id,
            conversation_id=conversation_id,
            model=self.settings.ai_model,
        )

    async def cancel(self, request_id: str) -> bool:
        """Cancel a running stream, if any, and notify listeners."""
        task = self._tasks.pop(request_id, None)
        if task is None:
            return False
        self._conversation_ids.pop(request_id, None)
        task.cancel()
        await self.broadcaster(CHAT_CANCELLED, {"request_id": request_id})
        return True

    async def _run(self, request_id: str, conversation_id: str, prompt: str) -> None:
        started = datetime.now(UTC)
        await self.broadcaster(
            CHAT_START,
            {
                "request_id": request_id,
                "conversation_id": conversation_id,
                "model": self.settings.ai_model,
            },
        )
        await self.broadcaster(AI_THINKING, {"request_id": request_id})

        # Prepare the turn inside a session (context + history + system prompt).
        messages: list[ChatMessage] = []
        parts: list[str] = []
        try:
            async with self._session_factory() as session:
                registry = build_tool_registry(
                    session,
                    include_network=self.settings.ai_enable_live_tools,
                )
                if self._conversation_factory is not None:
                    manager = self._conversation_factory(session)
                    prepared = await manager.prepare(
                        user_message=prompt,
                        conversation_id=conversation_id,
                        tools=registry.names(),
                    )
                    messages = prepared.messages
                else:
                    messages = [ChatMessage(role="user", content=prompt)]
                completion = await complete_with_tools(
                    self._ai_manager.provider,
                    messages,
                    registry,
                    self.settings,
                )
                if completion.text:
                    parts = [completion.text]
        except Exception:  # noqa: BLE001 — fall back to a bare user turn.
            messages = [ChatMessage(role="user", content=prompt)]
            fallback = await FallbackProvider().complete(messages)
            parts = [fallback.text] if fallback.text else []

        token_count = 0
        for part in parts:
            token_count += len(part.split())
            await self.broadcaster(
                CHAT_CHUNK, {"request_id": request_id, "text": part}
            )
            await asyncio.sleep(0)

        full = "".join(parts)
        latency_ms = int((datetime.now(UTC) - started).total_seconds() * 1000)

        async with self._session_factory() as session:
            messages_repo = MessageRepository(session)
            conversations = ConversationRepository(session)
            row = await messages_repo.create(
                {
                    "conversation_id": conversation_id,
                    "role": "assistant",
                    "content": full,
                    "latency_ms": latency_ms,
                    "tokens": token_count,
                }
            )
            count = await messages_repo.count_for(conversation_id)
            await conversations.update(
                conversation_id,
                {
                    "message_count": count,
                    "last_activity": datetime.now(UTC),
                    "last_model": self.settings.ai_model,
                },
            )
        try:
            await self.broadcaster(
                CHAT_END,
                {
                    "request_id": request_id,
                    "conversation_id": conversation_id,
                    "message_id": row.id,
                    "model": self.settings.ai_model,
                    "latency_ms": latency_ms,
                    "token_count": token_count,
                },
            )
        finally:
            self._tasks.pop(request_id, None)
            self._conversation_ids.pop(request_id, None)
