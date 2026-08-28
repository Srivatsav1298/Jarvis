"""MemoryManager — CRUD over memory entries plus ranked recall.

Create/update now compute a deterministic local embedding so the Memory
Intelligence layer (app/ai/memory/intelligence.py) can rank and consolidate.
"""
from typing import Any

from app.ai.memory.intelligence import MemoryIntelligence, embed_text
from app.repositories.implementations import MemoryRepository
from app.schemas.memory import MemoryEntryCreate, MemoryEntryUpdate


class MemoryManager:
    """Manages persisted memory entries for the assistant."""

    def __init__(self, repository: MemoryRepository) -> None:
        self.repository = repository
        self.intelligence = MemoryIntelligence(repository)

    async def list(
        self, *, limit: int, offset: int, kind: str | None = None
    ) -> tuple[list[Any], int]:
        """Return a page of memory entries (optionally by kind) plus total."""
        if kind:
            items = await self.repository.list_by_kind(
                kind=kind, limit=limit, offset=offset
            )
            total = await self.repository.count_by_kind(kind)
        else:
            items = await self.repository.list(limit=limit, offset=offset)
            total = await self.repository.count()
        return list(items), total

    async def create(self, payload: MemoryEntryCreate) -> Any:
        """Create a memory entry with a local embedding vector."""
        data = payload.model_dump(exclude_none=True)
        data["embedding"] = embed_text(data["content"])
        return await self.repository.create(data)

    async def get(self, entry_id: str) -> Any:
        """Fetch a single memory entry."""
        return await self.repository.get(entry_id)

    async def update(self, entry_id: str, payload: MemoryEntryUpdate) -> Any:
        """Update a memory entry, re-embedding when content changes."""
        data = payload.model_dump(exclude_none=True)
        if "content" in data:
            data["embedding"] = embed_text(data["content"])
        return await self.repository.update(entry_id, data)

    async def delete(self, entry_id: str) -> bool:
        """Delete a memory entry; returns False if it did not exist."""
        return await self.repository.delete(entry_id)

    async def search(self, query: str, limit: int = 10) -> list[Any]:
        """Ranked recall — keyword + vector relevance, weighted by importance,
        recency, and access frequency. No network or model required.
        """
        results = await self.intelligence.recall(query, limit=limit)
        return [r.entry for r in results]

    async def consolidate(self, **kwargs: Any) -> Any:
        """Run a consolidation pass (dedupe, promote hot, demote stale)."""
        return await self.intelligence.consolidate(**kwargs)
