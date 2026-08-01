"""Message ORM model — one turn in a conversation."""
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin
from app.utils.ids import new_id

if TYPE_CHECKING:
    from app.models.conversation import Conversation


class Message(TimestampMixin, Base):
    """A single message (user or assistant) inside a conversation."""

    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(32))
    content: Mapped[str] = mapped_column(Text)
    tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")
