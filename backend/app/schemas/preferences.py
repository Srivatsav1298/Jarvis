"""Preference schemas — key/value map surface."""
from typing import Any

from app.schemas.common import APIModel


class PreferencesRead(APIModel):
    """All preferences as an arbitrary key/value map."""

    data: dict[str, Any] = {}


class PreferencesUpdate(APIModel):
    """Settings selected via PUT are merged into the map."""

    data: dict[str, Any] = {}