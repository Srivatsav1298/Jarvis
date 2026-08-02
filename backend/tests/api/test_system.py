"""Tests for the /system/info endpoint."""
from httpx import AsyncClient


async def test_system_info(client: AsyncClient) -> None:
    response = await client.get("/api/v1/system/info")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "IronmanJARVIS"
    assert "python" in body
    assert body["environment"] == "testing"
