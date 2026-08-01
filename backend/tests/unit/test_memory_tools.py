"""Tests for the memory manager search stub and the tool registry."""
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database.base import Base
from app.memory.manager import MemoryManager
from app.repositories.implementations import MemoryRepository
from app.schemas.memory import MemoryEntryCreate
from app.tools.registry import build_default_registry


@pytest.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


async def test_memory_manager_search_ranks_by_importance(session) -> None:
    manager = MemoryManager(MemoryRepository(session))
    await manager.create(MemoryEntryCreate(kind="note", content="low", importance=0.2))
    await manager.create(MemoryEntryCreate(kind="note", content="high", importance=0.9))
    results = await manager.search("anything", limit=10)
    assert results[0].content == "high"


def test_tool_registry_lists_and_invokes() -> None:
    registry = build_default_registry()
    assert registry.invoke("ping") == {"pong": True}
    names = [tool["name"] for tool in registry.list()]
    assert "ping" in names
