"""Tests for service-layer logic (mock chat, settings merge, due count)."""
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config.settings import Settings
from app.database.base import Base
from app.models import Reminder
from app.repositories.implementations import (
    ConversationRepository,
    MessageRepository,
    ReminderRepository,
    SettingsRepository,
)
from app.schemas.chat import ChatMessageRequest
from app.services.chat import ChatService
from app.services.reminders import ReminderService
from app.services.settings import SettingsService
from app.utils.time import utcnow


@pytest.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


async def test_chat_service_returns_mock_reply(session) -> None:
    settings = Settings(_env_file=None)
    service = ChatService(
        ConversationRepository(session),
        MessageRepository(session),
        settings,
    )
    response = await service.respond(ChatMessageRequest(message="Hello JARVIS"))
    assert response.conversation_id
    assert "Hello JARVIS" in response.reply
    assert response.model == settings.ai_model


async def test_settings_service_merge(session) -> None:
    service = SettingsService(SettingsRepository(session))
    assert await service.get_all() == {}
    await service.merge({"theme": "dark"})
    await service.merge({"voice": "jarvis"})
    data = await service.get_all()
    assert data == {"theme": "dark", "voice": "jarvis"}


async def test_reminder_service_counts_due(session) -> None:
    session.add(
        Reminder(
            title="Pay bills",
            due_at=utcnow(),
            completed=False,
        )
    )
    session.add(
        Reminder(
            title="Tomorrow",
            due_at=utcnow(),
            completed=True,
        )
    )
    await session.commit()
    service = ReminderService(ReminderRepository(session))
    assert await service.count_due() == 1
