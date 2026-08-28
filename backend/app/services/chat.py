"""Chat service — persists each turn and returns the assistant's reply.

Uses the resolved AI provider + conversation engine when an AIManager is
injected (production wiring). Keeps a deterministic mock path when called
without one, so unit tests and degraded startups stay functional.
"""
import time
from datetime import UTC, datetime

from app.ai.conversation.conversation_manager import ConversationManager
from app.ai.providers.factory import build_provider
from app.ai.registry import AIManager
from app.ai.tools.factory import build_tool_registry
from app.ai.tools.runner import complete_with_tools
from app.config.settings import Settings
from app.exceptions import NotFoundError
from app.repositories.implementations import (
    ConversationRepository,
    MessageRepository,
)
from app.schemas.chat import ChatMessageRequest, ChatResponse


class ChatService:
    """Handles chat messages, persisting each turn and producing a reply."""

    def __init__(
        self,
        conversations: ConversationRepository,
        messages: MessageRepository,
        settings: Settings,
        *,
        ai_manager: AIManager | None = None,
        conversation_factory=None,
    ) -> None:
        self.conversations = conversations
        self.messages = messages
        self.settings = settings
        self._ai_manager = ai_manager or AIManager(
            build_provider(settings), settings.ai_provider
        )
        self._conversation_factory = conversation_factory

    async def respond(self, request: ChatMessageRequest) -> ChatResponse:
        """Persist the exchange and return the assistant reply."""
        started = time.perf_counter()

        conversation_id = request.conversation_id
        if conversation_id is None:
            conversation = await self.conversations.create(
                {"title": request.message[:60]}
            )
            conversation_id = conversation.id
        else:
            existing = await self.conversations.get(conversation_id)
            if existing is None:
                raise NotFoundError("Conversation not found")

        await self.messages.create(
            {"conversation_id": conversation_id, "role": "user", "content": request.message}
        )

        reply = await self._generate(request.message, conversation_id)

        await self.messages.create(
            {"conversation_id": conversation_id, "role": "assistant", "content": reply}
        )

        latency_ms = int((time.perf_counter() - started) * 1000)
        return ChatResponse(
            reply=reply,
            conversation_id=conversation_id,
            model=self.settings.ai_model,
            latency_ms=latency_ms,
            created_at=datetime.now(UTC),
        )

    async def _generate(self, message: str, conversation_id: str) -> str:
        """Produce a reply via the conversation engine + provider (or mock)."""
        if self._conversation_factory is not None:
            manager: ConversationManager = self._conversation_factory(
                self.messages.session
            )
            registry = build_tool_registry(
                self.messages.session,
                include_network=self.settings.ai_enable_live_tools,
            )
            prepared = await manager.prepare(
                user_message=message,
                conversation_id=conversation_id,
                tools=registry.names(),
            )
        else:
            prepared = None

        if prepared is not None:
            completion = await complete_with_tools(
                self._ai_manager.provider,
                prepared.messages,
                registry,
                self.settings,
            )
            return completion.text or ""

        # Deterministic mock path (no conversation engine wired).
        return (
            f"Understood, Sir. Processing “{message[:80]}” — "
            "response pipeline pending."
        )
