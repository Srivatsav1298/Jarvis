"""Memory entry schemas."""
from datetime import datetime

from pydantic import Field

from app.schemas.common import APIModel


class MemoryEntryCreate(APIModel):
    """Payload for creating a memory entry."""

    kind: str = "note"
    content: str = Field(min_length=1, max_length=4000)
    importance: float = Field(default=0.5, ge=0, le=1)


class MemoryEntryUpdate(APIModel):
    """Optional fields for updating a memory entry."""

    kind: str | None = None
    content: str | None = Field(default=None, min_length=1, max_length=4000)
    importance: float | None = Field(default=None, ge=0, le=1)


class MemoryEntryRead(APIModel):
    """Memory entry as returned by the API."""

    id: str
    kind: str
    content: str
    importance: float
    created_at: datetime
    updated_at: datetime
