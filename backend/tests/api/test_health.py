"""Tests for liveness/readiness probes."""
from httpx import AsyncClient


async def test_health_live(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_health_ready(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready"}
