"""UTC datetime helpers shared across the application."""
from datetime import UTC, datetime


def utcnow() -> datetime:
    """Return the current time as a timezone-aware UTC datetime."""
    return datetime.now(UTC)


def to_iso(value: datetime | None) -> str | None:
    """Serialize a datetime to an ISO-8601 string, or None."""
    return value.isoformat() if value else None
