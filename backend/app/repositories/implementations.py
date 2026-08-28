"""Concrete repositories — one small class per aggregate."""
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import func, select

from app.models import (
    Conversation,
    Job,
    MemoryEntry,
    Message,
    Notification,
    Preference,
    Project,
    Reminder,
    SettingsRecord,
)
from app.repositories.base import SQLAlchemyRepository
from app.utils.time import utcnow


class ConversationRepository(SQLAlchemyRepository[Conversation]):
    """Data access for conversations."""

    model = Conversation

    async def list(self, *, limit: int, offset: int) -> Sequence[Conversation]:
        """List conversations most-recently-updated first."""
        result = await self.session.execute(
            select(Conversation)
            .order_by(Conversation.updated_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return result.scalars().all()


class MessageRepository(SQLAlchemyRepository[Message]):
    """Data access for messages."""

    model = Message

    async def for_conversation(self, conversation_id: str) -> Sequence[Message]:
        """Return a conversation's messages in chronological order."""
        result = await self.session.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
        )
        return result.scalars().all()

    async def count_for(self, conversation_id: str) -> int:
        """Count messages in a conversation."""
        result = await self.session.execute(
            select(func.count())
            .select_from(Message)
            .where(Message.conversation_id == conversation_id)
        )
        return int(result.scalar_one())


class ProjectRepository(SQLAlchemyRepository[Project]):
    """Data access for projects."""

    model = Project


class PreferenceRepository(SQLAlchemyRepository[Preference]):
    """Data access for preferences."""

    model = Preference

    async def upsert(self, key: str, value: str | None) -> Preference:
        """Insert a preference or update its value when the key exists."""
        result = await self.session.execute(
            select(Preference).where(Preference.key == key)
        )
        row = result.scalar_one_or_none()
        if row is None:
            row = Preference(key=key, value=value)
            self.session.add(row)
        else:
            row.value = value
        await self.session.commit()
        await self.session.refresh(row)
        return row

    async def all_as_dict(self) -> dict[str, str | None]:
        """Return every preference as a key/value dict."""
        result = await self.session.execute(select(Preference))
        return {row.key: row.value for row in result.scalars()}


class NotificationRepository(SQLAlchemyRepository[Notification]):
    """Data access for notifications."""

    model = Notification


class ReminderRepository(SQLAlchemyRepository[Reminder]):
    """Data access for reminders."""

    model = Reminder

    async def count_due(self) -> int:
        """Count reminders that are due and not yet completed."""
        result = await self.session.execute(
            select(func.count())
            .select_from(Reminder)
            .where(
                Reminder.completed.is_(False),
                Reminder.due_at.is_not(None),
                Reminder.due_at <= utcnow(),
            )
        )
        return int(result.scalar_one())


class MemoryRepository(SQLAlchemyRepository[MemoryEntry]):
    """Data access for memory entries."""

    model = MemoryEntry

    async def list_by_kind(
        self, *, kind: str, limit: int, offset: int
    ) -> Sequence[MemoryEntry]:
        """List memory entries filtered by kind."""
        result = await self.session.execute(
            select(MemoryEntry)
            .where(MemoryEntry.kind == kind)
            .order_by(MemoryEntry.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return result.scalars().all()

    async def count_by_kind(self, kind: str) -> int:
        """Count memory entries of a given kind."""
        result = await self.session.execute(
            select(func.count())
            .select_from(MemoryEntry)
            .where(MemoryEntry.kind == kind)
        )
        return int(result.scalar_one())


class SettingsRepository(SQLAlchemyRepository[SettingsRecord]):
    """Data access for the singleton settings row."""

    model = SettingsRecord

    async def get_singleton(self) -> SettingsRecord | None:
        """Return the single settings row, if it exists."""
        result = await self.session.execute(select(SettingsRecord).limit(1))
        return result.scalar_one_or_none()


class JobRepository(SQLAlchemyRepository[Job]):
    """Data access for persisted job listings."""

    model = Job

    async def list_recent(self, *, limit: int) -> Sequence[Job]:
        """List the latest fetched jobs, highest match first."""
        result = await self.session.execute(
            select(Job)
            .order_by(Job.match.desc(), Job.posted_days_ago.asc())
            .limit(limit)
        )
        return result.scalars().all()

    async def replace_all(self, jobs: Sequence[Job]) -> int:
        """Replace the snapshot with ``jobs``; returns the inserted count.

        The table always holds exactly one snapshot: all existing rows are
        dropped before the fresh ones are inserted, so re-scrapes with
        overlapping ``dedupe_key`` values never violate the unique index.
        """
        result = await self.session.execute(select(Job.id))
        existing = [row[0] for row in result.all()]
        for job_id in existing:
            await self.session.delete(await self.session.get(Job, job_id))
        await self.session.flush()
        if jobs:
            for job in jobs:
                self.session.add(job)
        await self.session.commit()
        return len(jobs)

    async def list_dedupe_keys(self) -> set[str]:
        """Return every persisted dedupe key (for new-job diffing)."""
        result = await self.session.execute(select(Job.dedupe_key))
        return {row[0] for row in result.all()}

    async def latest_fetched_at(self) -> datetime | None:
        """Return the timestamp of the newest snapshot, if any."""
        result = await self.session.execute(
            select(func.max(Job.fetched_at)).select_from(Job)
        )
        return result.scalar_one_or_none()
