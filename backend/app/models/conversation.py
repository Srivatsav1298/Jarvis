"""Conversation ORM model — a persisted chat thread."""
from typing import TYPE_CHECKING

from sqlalchemy import String
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

    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )
