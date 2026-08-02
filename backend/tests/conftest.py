"""Shared pytest fixtures: test settings, lifespan-managed app, HTTP client."""
import pytest
import pytest_asyncio
from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient

from app.config.settings import Settings
from app.database.base import Base
from app.main import create_app


@pytest.fixture
def settings(tmp_path) -> Settings:
    """Test settings backed by a temp SQLite file."""
    return Settings(
        _env_file=None,
        environment="testing",
        debug=True,
        database_url=f"sqlite+aiosqlite:///{tmp_path / 'test.db'}",
        database_echo=False,
        log_level="CRITICAL",
        cors_origins=["http://localhost:5173"],
    )


@pytest_asyncio.fixture
async def app(settings):
    """App under test with schema created and lifespan running."""
    application = create_app(settings)
    async with LifespanManager(application):
        engine = application.state.engine
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        yield application


@pytest_asyncio.fixture
async def client(app):
    """Async HTTP client wired to the ASGI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client
