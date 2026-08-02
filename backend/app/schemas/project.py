"""Project schemas."""
from datetime import datetime

from pydantic import Field

from app.schemas.common import APIModel


class ProjectCreate(APIModel):
    """Payload for creating a project."""

    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    status: str = Field(default="active", pattern="^(active|paused|archived)$")
    color: str = Field(default="accent", max_length=16)


class ProjectUpdate(APIModel):
    """Optional fields for updating a project."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    status: str | None = Field(default=None, pattern="^(active|paused|archived)$")
    color: str | None = Field(default=None, max_length=16)


class ProjectRead(APIModel):
    """Project as returned by the API."""

    id: str
    name: str
    description: str | None
    status: str
    color: str
    created_at: datetime
    updated_at: datetime
