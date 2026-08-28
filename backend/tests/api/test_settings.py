"""Tests for the settings singleton endpoint."""
from httpx import AsyncClient


async def test_settings_get_and_merge(client: AsyncClient) -> None:
    got = await client.get("/api/v1/settings")
    assert got.status_code == 200
    assert got.json()["data"]["data"] == {}

    merged = await client.patch("/api/v1/settings", json={"data": {"theme": "dark"}})
    assert merged.json()["data"]["data"]["theme"] == "dark"

    merged2 = await client.patch("/api/v1/settings", json={"data": {"voice": "jarvis"}})
    assert merged2.json()["data"]["data"] == {"theme": "dark", "voice": "jarvis"}
