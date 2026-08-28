"""Conversation ORM model — a persisted chat thread."""
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin
from app.utils.ids import new_id

if TYPE_CHECKING:
    from app.models.message import Message


class Conversation(TimestampMixin, Base):
    """A single chat conversation containing many messages."""

    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(String(255), default="New conversation")
    pinned: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    created_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_activity: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    message_count: Mapped[int] = mapped_column(Integer, default=0)

    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )