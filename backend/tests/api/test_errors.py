"""Tests for the uniform error envelope."""
from httpx import AsyncClient


async def test_validation_error_envelope(client: AsyncClient) -> None:
    response = await client.post("/api/v1/memory/entries", json={"content": ""})
    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "validation_error"
    assert body["error"]["status"] == 422


async def test_not_found_error_envelope(client: AsyncClient) -> None:
    response = await client.get("/api/v1/memory/entries/nope")
    assert response.status_code == 404
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "not_found"
    assert body["error"]["title"] == "Memory entry not found"
