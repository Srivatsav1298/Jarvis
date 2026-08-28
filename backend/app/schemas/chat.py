"""Chat request/response schemas (mock stage)."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import APIModel


class ChatMessageRequest(APIModel):
    """Incoming user message to the chat endpoint."""

    message: str
    conversation_id: str | None = None


class ChatRequest(APIModel):
    """Body for starting a streaming chat session."""

    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = None
    request_id: str = Field(min_length=1, max_length=64)


class ChatAccepted(APIModel):
    """Acknowledgment returned immediately when a stream is started."""

    request_id: str
    conversation_id: str
    model: str


class ChatResponse(APIModel):
    """Mock chat reply plus provenance metadata."""

    reply: str
    conversation_id: str
    model: str
    latency_ms: int
    created_at: datetime


class MessageRead(APIModel):
    """One persisted message turn."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    conversation_id: str
    role: str
    content: str
    tokens: int | None = None
    latency_ms: int | None = None
    created_at: datetime


class ConversationRead(BaseModel):
    """Conversation summary row used in list/detail responses."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    pinned: bool = False
    created_by: str | None = None
    last_model: str | None = None
    last_activity: datetime | None = None
    message_count: int = 0
    created_at: datetime
    updated_at: datetime


class ConversationDetail(ConversationRead):
    """Conversation plus its messages."""

    messages: list[MessageRead] = []


class ConversationCreate(BaseModel):
    """Body for creating a conversation."""

    title: str = "New conversation"
    pinned: bool = False
    created_by: str | None = None


class ConversationUpdate(BaseModel):
    """Body for patching a conversation."""

    title: str | None = None
    pinned: bool | None = None
