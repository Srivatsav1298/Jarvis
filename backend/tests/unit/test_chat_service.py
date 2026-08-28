"""Tests for ChatStreamManager: streaming events, persistence, cancellation."""
import asyncio

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config.settings import Settings
from app.core.chat_stream_manager import ChatStreamManager
from app.database.base import Base
from app.repositories.implementations import ConversationRepository
from app.schemas.chat import ChatRequest


@pytest.fixture
async def manager():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    events: list[tuple[str, dict]] = []

    async def broadcaster(type_: str, payload: dict) -> None:
        events.append((type_, payload))

    m = ChatStreamManager(
        session_factory=factory,
        settings=Settings(_env_file=None),
        broadcaster=broadcaster,
    )
    m._events = events
    yield m
    await engine.dispose()


async def test_start_emits_full_stream_and_persists(manager) -> None:
    accepted = await manager.start(
        ChatRequest(message="Hello JARVIS", request_id="r-1")
    )
    assert accepted.conversation_id
    task = manager._tasks["r-1"]
    await asyncio.wait_for(task, 5)

    types = [t for t, _ in manager._events]
    assert "chat.started" in types
    assert "ai.thinking" in types
    assert "chat.chunk" in types

    end = next(p for t, p in manager._events if t == "chat.end")
    assert end["conversation_id"] == accepted.conversation_id

    async with manager._session_factory() as session:
        bags = ConversationRepository(session)
        conversation = await bags.get(accepted.conversation_id)
        assert conversation.message_count == 2
        assert conversation.last_model == manager.settings.ai_model


async def test_cancel_stops_stream(manager) -> None:
    await manager.start(ChatRequest(message="x", request_id="r-2"))
    assert await manager.cancel("r-2") is True
    types = [t for t, _ in manager._events]
    assert "chat.cancelled" in types
    assert "chat.end" not in types


async def test_cancel_unknown_returns_false(manager) -> None:
    assert await manager.cancel("nope") is False