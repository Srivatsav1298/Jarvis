"""Reminder service — CRUD and due-item sweeps."""
from typing import Any

from app.repositories.implementations import ReminderRepository
from app.schemas.reminder import ReminderCreate, ReminderUpdate


class ReminderService:
    """Manages reminders and exposes a due-item query for the scheduler."""

    def __init__(self, repository: ReminderRepository) -> None:
        self.repository = repository

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
        """Return the count of due reminders, delegated to the repository."""
        return await self.repository.count_due()
