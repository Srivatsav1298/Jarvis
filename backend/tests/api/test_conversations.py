"""Conversation CRUD endpoints (enveloped)."""
from httpx import AsyncClient


async def test_conversation_lifecycle(client: AsyncClient) -> None:
    created = await client.post("/api/v1/conversations", json={})
    assert created.status_code == 201
    body = created.json()
    assert body["success"] is True
    cid = body["data"]["id"]
    assert body["data"]["message_count"] == 0

    listed = await client.get("/api/v1/conversations")
    listed_body = listed.json()
    assert listed_body["success"] is True
    assert any(x["id"] == cid for x in listed_body["data"]["items"])

    detail = await client.get(f"/api/v1/conversations/{cid}")
    assert detail.json()["data"]["messages"] == []

    patched = await client.patch(
        f"/api/v1/conversations/{cid}", json={"title": "Renamed", "pinned": True}
    )
    patched_body = patched.json()
    assert patched_body["data"]["title"] == "Renamed"
    assert patched_body["data"]["pinned"] is True

    deleted = await client.delete(f"/api/v1/conversations/{cid}")
    assert deleted.status_code == 204

    missing = await client.get(f"/api/v1/conversations/{cid}")
    assert missing.status_code == 404


async def test_conversation_missing_id_returns_404(client: AsyncClient) -> None:
    response = await client.get("/api/v1/conversations/missing-id")
    assert response.status_code == 404