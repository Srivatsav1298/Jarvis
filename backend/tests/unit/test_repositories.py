"""Tests for the generic SQLAlchemy repository."""
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database.base import Base
from app.repositories.implementations import MemoryRepository, SettingsRepository


@pytest.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


async def test_memory_repository_crud(session) -> None:
    repo = MemoryRepository(session)
    created = await repo.create({"kind": "note", "content": "remember this", "importance": 0.8})
    assert created.id

    fetched = await repo.get(created.id)
    assert fetched is not None and fetched.content == "remember this"

    updated = await repo.update(created.id, {"importance": 0.2})
    assert updated is not None and updated.importance == 0.2

    assert await repo.count() == 1
    assert await repo.delete(created.id) is True
    assert await repo.get(created.id) is None


async def test_settings_repository_singleton(session) -> None:
    repo = SettingsRepository(session)
    assert await repo.get_singleton() is None
    await repo.create({"data": {"theme": "dark"}})
    row = await repo.get_singleton()
    assert row is not None and row.data["theme"] == "dark"
