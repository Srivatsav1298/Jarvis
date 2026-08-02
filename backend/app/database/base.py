"""Declarative base and shared mixins for every ORM model."""
from datetime import datetime

from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.utils.time import utcnow


class Base(DeclarativeBase):
    """Abstract declarative base class for all models."""


class TimestampMixin:
    """Adds UTC created_at/updated_at columns with sensible defaults."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
