"""Tests for memory entry CRUD."""
from httpx import AsyncClient


async def test_memory_crud_flow(client: AsyncClient) -> None:
    created = await client.post(
        "/api/v1/memory/entries",
        json={"kind": "fact", "content": "Sir prefers dark mode", "importance": 0.9},
    )
    assert created.status_code == 201
    entry_id = created.json()["id"]

    fetched = await client.get(f"/api/v1/memory/entries/{entry_id}")
    assert fetched.status_code == 200
    assert fetched.json()["content"] == "Sir prefers dark mode"

    updated = await client.patch(
        f"/api/v1/memory/entries/{entry_id}", json={"importance": 0.4}
    )
    assert updated.json()["importance"] == 0.4

    listing = await client.get("/api/v1/memory/entries")
    assert listing.json()["total"] == 1

    deleted = await client.delete(f"/api/v1/memory/entries/{entry_id}")
    assert deleted.status_code == 204
