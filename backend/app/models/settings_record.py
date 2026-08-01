"""SettingsRecord ORM model — a singleton row holding app settings as JSON."""
from typing import Any

from sqlalchemy import JSON, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin


class SettingsRecord(TimestampMixin, Base):
    """Singleton application-settings row (one row, id=1)."""

    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
