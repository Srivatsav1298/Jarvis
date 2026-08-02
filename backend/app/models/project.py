"""Project ORM model — a tracked work item or initiative."""
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin
from app.utils.ids import new_id


class Project(TimestampMixin, Base):
    """A project the assistant tracks for its owner."""

    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active")
    color: Mapped[str] = mapped_column(String(16), default="accent")
