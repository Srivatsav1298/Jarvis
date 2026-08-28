"""ConversationService — CRUD and metadata for chat threads."""
from typing import Any

from app.repositories.implementations import (
    ConversationRepository,
    MessageRepository,
)


class ConversationService:
    """Thin orchestration over conversation and message repositories."""

    def __init__(
        self,
        conversations: ConversationRepository,
        messages: MessageRepository,
    ) -> None:
        self.conversations = conversations
        self.messages = messages

    async def list_conversations(
        self, *, limit: int, offset: int
    ) -> tuple[list[dict], int]:
        rows = await self.conversations.list(limit=limit, offset=offset)
        total = await self.conversations.count()
        return [self._to_read(r) for r in rows], total

    async def create_conversation(self, *, title: str = "New conversation") -> dict:
        row = await self.conversations.create({"title": title})
        return self._to_read(row)

    async def get_conversation(self, conversation_id: str) -> dict | None:
        row = await self.conversations.get(conversation_id)
        if row is None:
            return None
        messages = await self.messages.for_conversation(conversation_id)
        return {**self._to_read(row), "messages": [self._to_msg(m) for m in messages]}

    async def update_conversation(
        self, conversation_id: str, data: dict[str, Any]
    ) -> dict | None:
        row = await self.conversations.update(conversation_id, data)
        return self._to_read(row) if row else None

    async def delete_conversation(self, conversation_id: str) -> bool:
        return await self.conversations.delete(conversation_id)

    @staticmethod
    def _to_read(row: Any) -> dict:
        return {
            "id": row.id,
            "title": row.title,
            "pinned": bool(row.pinned),
            "created_by": row.created_by,
            "last_model": row.last_model,
            "last_activity": row.last_activity,
            "message_count": row.message_count,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
        }

    @staticmethod
    def _to_msg(message: Any) -> dict:
        return {
            "id": message.id,
            "conversation_id": message.conversation_id,
            "role": message.role,
            "content": message.content,
            "tokens": message.tokens,
            "latency_ms": message.latency_ms,
            "created_at": message.created_at,
        }