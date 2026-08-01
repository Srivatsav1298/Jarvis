"""Reminder service — CRUD and due-item sweeps."""
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Reminder
from app.repositories.implementations import ReminderRepository
from app.schemas.reminder import ReminderCreate, ReminderUpdate
from app.utils.time import utcnow


class ReminderService:
    """Manages reminders and exposes a due-item query for the scheduler."""

    def __init__(self, repository: ReminderRepository, session: AsyncSession) -> None:
        self.repository = repository
        self.session = session

    async def list(self, *, limit: int, offset: int) -> tuple[list[Any], int]:
        items = await self.repository.list(limit=limit, offset=offset)
        total = await self.repository.count()
        return list(items), total

    async def create(self, payload: ReminderCreate) -> Any:
        return await self.repository.create(payload.model_dump(exclude_none=True))

    async def get(self, reminder_id: str) -> Any:
        return await self.repository.get(reminder_id)

    async def update(self, reminder_id: str, payload: ReminderUpdate) -> Any:
        return await self.repository.update(reminder_id, payload.model_dump(exclude_none=True))

    async def delete(self, reminder_id: str) -> bool:
        return await self.repository.delete(reminder_id)

    async def count_due(self) -> int:
        """Count reminders that are due and not yet completed."""
        result = await self.session.execute(
            select(Reminder).where(
                Reminder.completed.is_(False),
                Reminder.due_at.is_not(None),
                Reminder.due_at <= utcnow(),
            )
        )
        return len(result.scalars().all())
