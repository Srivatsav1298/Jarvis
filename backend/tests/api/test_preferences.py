"""Tests for the preferences GET/PUT map endpoint."""
from httpx import AsyncClient


async def test_preferences_empty_then_merge(client: AsyncClient) -> None:
    empty = await client.get("/api/v1/preferences")
    assert empty.status_code == 200
    assert empty.json()["data"]["data"] == {}

    updated = await client.put(
        "/api/v1/preferences", json={"data": {"theme": "dark", "voice": "jarvis"}}
    )
    assert updated.status_code == 200
    assert updated.json()["data"]["data"] == {"theme": "dark", "voice": "jarvis"}

    refetched = await client.get("/api/v1/preferences")
    assert refetched.json()["data"]["data"] == {"theme": "dark", "voice": "jarvis"}


async def test_preferences_merge_overwrites_value(client: AsyncClient) -> None:
    await client.put("/api/v1/preferences", json={"data": {"theme": "light"}})
    overwritten = await client.put(
        "/api/v1/preferences", json={"data": {"theme": "dark"}}
    )
    assert overwritten.json()["data"]["data"] == {"theme": "dark"}