"""PreferencesService — key/value preferences backed by the preferences table."""
from typing import Any

from app.repositories.implementations import PreferenceRepository


class PreferencesService:
    """Reads and merges user preferences."""

    def __init__(self, repository: PreferenceRepository) -> None:
        self.repository = repository

    async def get_all(self) -> dict[str, Any]:
        return await self.repository.all_as_dict()

    async def merge(self, data: dict[str, Any]) -> dict[str, Any]:
        for key, value in data.items():
            await self.repository.upsert(key, str(value) if value is not None else None)
        return await self.repository.all_as_dict()