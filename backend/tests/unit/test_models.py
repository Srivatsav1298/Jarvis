"""Tests for ORM model creation and round-tripping."""
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database.base import Base
from app.models import Conversation, MemoryEntry, Message, SettingsRecord


@pytest.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


async def test_conversation_with_messages_roundtrip(session) -> None:
    conversation = Conversation(title="Greetings")
    session.add(conversation)
    await session.flush()
    session.add_all(
        [
            Message(conversation_id=conversation.id, role="user", content="Hello"),
            Message(conversation_id=conversation.id, role="assistant", content="Hi!"),
        ]
    )
    await session.commit()
    await session.refresh(conversation, ["messages"])
    assert len(conversation.messages) == 2
    assert all(m.created_at is not None for m in conversation.messages)


async def test_memory_entry_and_settings_roundtrip(session) -> None:
    session.add(
        MemoryEntry(kind="fact", content="Sir prefers dark mode", importance=0.9)
    )
    session.add(SettingsRecord(data={"theme": "dark"}))
    await session.commit()
    result = await session.execute(text("SELECT count(*) FROM memory_entries"))
    assert result.scalar_one() == 1
    result = await session.execute(text("SELECT count(*) FROM settings"))
    assert result.scalar_one() == 1
