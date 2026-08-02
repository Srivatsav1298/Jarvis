"""Chat service — deterministic mock replies until AI is wired in."""
import time
from datetime import UTC, datetime

from app.config.settings import Settings
from app.exceptions import NotFoundError
from app.repositories.implementations import (
    ConversationRepository,
    MessageRepository,
)
from app.schemas.chat import ChatMessageRequest, ChatResponse


class ChatService:
    """Handles chat messages, persisting each turn and returning a mock reply."""

    def __init__(
        self,
        conversations: ConversationRepository,
        messages: MessageRepository,
        settings: Settings,
    ) -> None:
        self.conversations = conversations
        self.messages = messages
        self.settings = settings

    async def respond(self, request: ChatMessageRequest) -> ChatResponse:
        """Persist the exchange and return a deterministic placeholder reply."""
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
        reply = (
            f"Understood, Sir. Processing “{request.message[:80]}” — "
            "response pipeline pending."
        )
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
