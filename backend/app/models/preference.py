"""Preference ORM model — a key/value user preference row."""
from sqlalchemy import String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin
from app.utils.ids import new_id


class Preference(TimestampMixin, Base):
    """A single user preference identified by a unique key."""

    __tablename__ = "preferences"
    __table_args__ = (UniqueConstraint("key", name="uq_preferences_key"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    key: Mapped[str] = mapped_column(String(100), index=True)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
