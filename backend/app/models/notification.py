"""Notification ORM model — an alert surfaced in the UI."""
from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin
from app.utils.ids import new_id


class Notification(TimestampMixin, Base):
    """A system or assistant notification."""

    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    type: Mapped[str] = mapped_column(String(64), default="info")
    severity: Mapped[str] = mapped_column(String(16), default="info")
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
