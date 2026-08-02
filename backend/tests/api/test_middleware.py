"""Tests for middleware behavior (timing header, CORS)."""
import pytest
from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient

from app.config.settings import Settings
from app.main import create_app


@pytest.mark.asyncio
async def test_process_time_header_and_cors(tmp_path) -> None:
    settings = Settings(
        _env_file=None,
        environment="testing",
        database_url=f"sqlite+aiosqlite:///{tmp_path / 'mw.db'}",
        log_level="CRITICAL",
        cors_origins=["http://localhost:5173"],
    )
    application = create_app(settings)
    async with LifespanManager(application):
        transport = ASGITransport(app=application)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/", headers={"Origin": "http://localhost:5173"})
            assert "x-process-time-ms" in response.headers
            assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
