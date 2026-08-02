"""Shared Pydantic models: base schema, error body, generic list response."""
from pydantic import BaseModel, ConfigDict


class APIModel(BaseModel):
    """Base schema; reads attributes from ORM objects."""

    model_config = ConfigDict(from_attributes=True)


class ErrorBody(BaseModel):
    """Uniform error envelope returned by exception handlers."""

    type: str
    title: str
    status: int
    code: str
    detail: object | None = None


class ListResponse[T](BaseModel):
    """Generic paginated payload: items plus total count."""

    items: list[T]
    total: int
