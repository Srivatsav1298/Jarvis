"""Reminder schemas."""
from datetime import datetime

from pydantic import Field

from app.schemas.common import APIModel


class ReminderCreate(APIModel):
    """Payload for creating a reminder."""

    title: str = Field(min_length=1, max_length=200)
    note: str | None = None
    due_at: datetime | None = None
    conversation_id: str | None = None


class ReminderUpdate(APIModel):
    """Optional fields for updating a reminder."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    note: str | None = None
    due_at: datetime | None = None
    completed: bool | None = None


class ReminderRead(APIModel):
    """Reminder as returned by the API."""

    id: str
    title: str
    note: str | None
    due_at: datetime | None
    completed: bool
    conversation_id: str | None
    created_at: datetime
