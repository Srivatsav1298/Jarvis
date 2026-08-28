"""Tests for the /system/metrics endpoint."""
from httpx import AsyncClient


async def test_system_metrics_envelope(client: AsyncClient) -> None:
    response = await client.get("/api/v1/system/metrics")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    data = body["data"]
    assert "cpu_percent" in data
    assert "ram_percent" in data
    assert "network" in data
    assert "collected_at" in data