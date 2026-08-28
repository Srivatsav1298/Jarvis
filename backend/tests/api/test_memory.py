"""Tests for memory entry CRUD."""
from httpx import AsyncClient


async def test_memory_crud_flow(client: AsyncClient) -> None:
    created = await client.post(
        "/api/v1/memory/entries",
        json={"kind": "fact", "content": "Sir prefers dark mode", "importance": 0.9},
    )
    assert created.status_code == 201
    entry_id = created.json()["data"]["id"]

    fetched = await client.get(f"/api/v1/memory/entries/{entry_id}")
    assert fetched.status_code == 200
    assert fetched.json()["data"]["content"] == "Sir prefers dark mode"

    updated = await client.patch(
        f"/api/v1/memory/entries/{entry_id}", json={"importance": 0.4}
    )
    assert updated.json()["data"]["importance"] == 0.4

    listing = await client.get("/api/v1/memory/entries")
    assert listing.json()["data"]["total"] == 1

    deleted = await client.delete(f"/api/v1/memory/entries/{entry_id}")
    assert deleted.status_code == 204


async def test_memory_list_filters_by_kind(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/memory/entries",
        json={"kind": "fact", "content": "A fact", "importance": 0.5},
    )
    await client.post(
        "/api/v1/memory/entries",
        json={"kind": "preference", "content": "A preference", "importance": 0.5},
    )

    facts = await client.get("/api/v1/memory/entries?kind=fact")
    assert facts.json()["data"]["total"] == 1
    assert facts.json()["data"]["items"][0]["kind"] == "fact"

    all_entries = await client.get("/api/v1/memory/entries")
    assert all_entries.json()["data"]["total"] == 2
