"""Concrete repositories — one small class per aggregate."""
from sqlalchemy import select

from app.models import (
    Conversation,
    MemoryEntry,
    Message,
    Notification,
    Preference,
    Project,
    Reminder,
    SettingsRecord,
)
from app.repositories.base import SQLAlchemyRepository


class ConversationRepository(SQLAlchemyRepository[Conversation]):
    """Data access for conversations."""

    model = Conversation


class MessageRepository(SQLAlchemyRepository[Message]):
    """Data access for messages."""

    model = Message


class ProjectRepository(SQLAlchemyRepository[Project]):
    """Data access for projects."""

    model = Project


class PreferenceRepository(SQLAlchemyRepository[Preference]):
    """Data access for preferences."""

    model = Preference


class NotificationRepository(SQLAlchemyRepository[Notification]):
    """Data access for notifications."""

    model = Notification


class ReminderRepository(SQLAlchemyRepository[Reminder]):
    """Data access for reminders."""

    model = Reminder


class MemoryRepository(SQLAlchemyRepository[MemoryEntry]):
    """Data access for memory entries."""

    model = MemoryEntry


class SettingsRepository(SQLAlchemyRepository[SettingsRecord]):
    """Data access for the singleton settings row."""

    model = SettingsRecord

    async def get_singleton(self) -> SettingsRecord | None:
        """Return the single settings row, if it exists."""
        result = await self.session.execute(select(SettingsRecord).limit(1))
        return result.scalar_one_or_none()
