"""Job ORM model — a persisted job listing from the daily market refresh."""
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin
from app.utils.ids import new_id
from app.utils.time import utcnow


class Job(TimestampMixin, Base):
    """A single scraped job listing, refreshed on a daily schedule."""

    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    dedupe_key: Mapped[str] = mapped_column(
        String(300), unique=True, index=True, nullable=False
    )
    company: Mapped[str] = mapped_column(String(200), default="Unknown")
    role: Mapped[str] = mapped_column(String(200), default="Role")
    location: Mapped[str] = mapped_column(String(200), default="Norway")
    source: Mapped[str] = mapped_column(String(50), default="")
    source_url: Mapped[str] = mapped_column(Text, default="")
    posted_days_ago: Mapped[int] = mapped_column(Integer, default=0)
    skills: Mapped[list[str]] = mapped_column(JSON, default=list)
    ai_summary: Mapped[str] = mapped_column(Text, default="")
    match: Mapped[int] = mapped_column(Integer, default=0)
    ai_recommendation: Mapped[str] = mapped_column(String(20), default="consider")
    salary: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    visa_sponsor: Mapped[bool] = mapped_column(Boolean, default=False)
    remote: Mapped[str] = mapped_column(String(20), default="hybrid")
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
