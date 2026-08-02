"""Notification service — CRUD and read-state helpers."""
from typing import Any

from app.repositories.implementations import NotificationRepository
from app.schemas.notification import NotificationCreate


class NotificationService:
    """Manages notifications surfaced to the UI."""

    def __init__(self, repository: NotificationRepository) -> None:
        self.repository = repository

    async def list(self, *, limit: int, offset: int) -> tuple[list[Any], int]:
        items = await self.repository.list(limit=limit, offset=offset)
        total = await self.repository.count()
        return list(items), total

    async def create(self, payload: NotificationCreate) -> Any:
        return await self.repository.create(payload.model_dump(exclude_none=True))

    async def mark_read(self, notification_id: str, read: bool) -> Any:
        return await self.repository.update(notification_id, {"read": read})

    async def delete(self, notification_id: str) -> bool:
        return await self.repository.delete(notification_id)
