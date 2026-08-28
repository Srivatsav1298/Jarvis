"""Unit tests for ConversationService (repo fakes)."""
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database.base import Base
from app.repositories.implementations import (
    ConversationRepository,
    MessageRepository,
)
from app.services.conversations import ConversationService


@pytest.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


def service(session) -> ConversationService:
    return ConversationService(
        ConversationRepository(session), MessageRepository(session)
    )


async def test_create_conversation_returns_read_with_zero_messages(session) -> None:
    result = await service(session).create_conversation(title="Ops Standup")
    assert result["title"] == "Ops Standup"
    assert result["message_count"] == 0
    assert result["pinned"] is False
    assert result["id"]


async def test_update_conversation_persists_pinned(session) -> None:
    svc = service(session)
    created = await svc.create_conversation(title="Draft")
    updated = await svc.update_conversation(created["id"], {"pinned": True})
    assert updated["pinned"] is True
    assert updated["title"] == "Draft"


async def test_get_missing_conversation_is_none(session) -> None:
    assert await service(session).get_conversation("nope") is None