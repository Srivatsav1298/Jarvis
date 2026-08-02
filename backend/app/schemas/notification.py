"""Notification schemas."""
from datetime import datetime

from pydantic import Field

from app.schemas.common import APIModel


class NotificationCreate(APIModel):
    """Payload for creating a notification."""

    type: str = "info"
    severity: str = Field(default="info", pattern="^(info|ok|warn|danger|accent)$")
    title: str = Field(min_length=1, max_length=200)
    message: str | None = None


class NotificationUpdate(APIModel):
    """Optional fields for updating a notification."""

    read: bool | None = None
    severity: str | None = Field(default=None, pattern="^(info|ok|warn|danger|accent)$")
    title: str | None = Field(default=None, min_length=1, max_length=200)
    message: str | None = None


class NotificationRead(APIModel):
    """Notification as returned by the API."""

    id: str
    type: str
    severity: str
    title: str
    message: str | None
    read: bool
    created_at: datetime
