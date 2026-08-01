"""MemoryEntry ORM model — a persisted assistant memory with embedding hook."""
from typing import Any

from sqlalchemy import JSON, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin
from app.utils.ids import new_id


class MemoryEntry(TimestampMixin, Base):
    """A single memory the assistant persists for its owner."""

    __tablename__ = "memory_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    kind: Mapped[str] = mapped_column(String(64), default="note")
    content: Mapped[str] = mapped_column(Text)
    importance: Mapped[float] = mapped_column(Float, default=0.5)
    data: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    embedding: Mapped[list[float] | None] = mapped_column(JSON, nullable=True)
