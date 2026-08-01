"""Application settings schemas."""
from typing import Any

from app.schemas.common import APIModel


class SettingsRead(APIModel):
    """Current persisted application settings."""

    data: dict[str, Any]


class SettingsUpdate(APIModel):
    """Partial update payload for persisted settings."""

    data: dict[str, Any]
