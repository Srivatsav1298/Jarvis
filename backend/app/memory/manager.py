"""MemoryManager — CRUD over memory entries plus a search stub."""
from typing import Any

from app.repositories.implementations import MemoryRepository
from app.schemas.memory import MemoryEntryCreate, MemoryEntryUpdate


class MemoryManager:
    """Manages persisted memory entries for the assistant."""

    def __init__(self, repository: MemoryRepository) -> None:
        self.repository = repository

    async def list(self, *, limit: int, offset: int) -> tuple[list[Any], int]:
        """Return a page of memory entries plus the total count."""
        items = await self.repository.list(limit=limit, offset=offset)
        total = await self.repository.count()
        return list(items), total

    async def create(self, payload: MemoryEntryCreate) -> Any:
        """Create a memory entry; embedding hook returns None for now."""
        data = payload.model_dump(exclude_none=True)
        data["embedding"] = await self._embed(data["content"])
        return await self.repository.create(data)

    async def get(self, entry_id: str) -> Any:
        """Fetch a single memory entry."""
        return await self.repository.get(entry_id)

    async def update(self, entry_id: str, payload: MemoryEntryUpdate) -> Any:
        """Update a memory entry, re-embedding when content changes."""
        data = payload.model_dump(exclude_none=True)
        if "content" in data:
            data["embedding"] = await self._embed(data["content"])
        return await self.repository.update(entry_id, data)

    async def delete(self, entry_id: str) -> bool:
        """Delete a memory entry; returns False if it did not exist."""
        return await self.repository.delete(entry_id)

    async def search(self, query: str, limit: int = 10) -> list[Any]:
        """Deterministic stub search — highest-importance entries first.

        Replaced by a real vector index (pgvector / sqlite-vec) in the future.
        """
        _ = query  # reserved for semantic retrieval
        items = await self.repository.list(limit=limit, offset=0)
        return sorted(items, key=lambda entry: entry.importance, reverse=True)

    @staticmethod
    async def _embed(content: str) -> list[float] | None:
        """Placeholder for future vector embedding of memory content."""
        return None
