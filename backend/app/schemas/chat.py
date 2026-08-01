"""Chat request/response schemas (mock stage)."""
from datetime import datetime

from app.schemas.common import APIModel


class ChatMessageRequest(APIModel):
    """Incoming user message to the chat endpoint."""

    message: str
    conversation_id: str | None = None


class ChatResponse(APIModel):
    """Mock chat reply plus provenance metadata."""

    reply: str
    conversation_id: str
    model: str
    latency_ms: int
    created_at: datetime
