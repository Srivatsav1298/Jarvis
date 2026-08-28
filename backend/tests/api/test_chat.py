"""Tests for the mock chat endpoint."""
from httpx import AsyncClient


async def test_chat_returns_mock_reply(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/chat/messages",
        json={"message": "What is my focus today?"},
    )
    assert response.status_code == 200
    body = response.json()["data"]
    assert body["conversation_id"]
    assert body["model"]
    assert body["latency_ms"] >= 0


async def test_chat_with_existing_conversation(client: AsyncClient) -> None:
    first = await client.post("/api/v1/chat/messages", json={"message": "hello"})
    conversation_id = first.json()["data"]["conversation_id"]
    second = await client.post(
        "/api/v1/chat/messages",
        json={"message": "again", "conversation_id": conversation_id},
    )
    assert second.json()["data"]["conversation_id"] == conversation_id


async def test_chat_unknown_conversation_404(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/chat/messages",
        json={"message": "hi", "conversation_id": "does-not-exist"},
    )
    assert response.status_code == 404
