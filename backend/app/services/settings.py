"""Settings service — reads and merges the singleton settings row."""
from typing import Any

from app.repositories.implementations import SettingsRepository


class SettingsService:
    """Access and update the persisted application settings singleton."""

    def __init__(self, repository: SettingsRepository) -> None:
        self.repository = repository

    async def get_all(self) -> dict[str, Any]:
        """Return the persisted settings dict (empty dict if none stored)."""
        row = await self.repository.get_singleton()
        return dict(row.data) if row else {}

    async def merge(self, updates: dict[str, Any]) -> dict[str, Any]:
        """Merge updates into the singleton settings row and return it."""
        row = await self.repository.get_singleton()
        if row is None:
            row = await self.repository.create({"data": dict(updates)})
            return dict(row.data)
        merged = {**row.data, **updates}
        updated = await self.repository.update(row.id, {"data": merged})
        return dict(updated.data)
