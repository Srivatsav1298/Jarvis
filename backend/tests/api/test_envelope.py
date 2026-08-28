"""REST envelope: success => {success:true,data}, errors => {success:false,error}."""
from httpx import AsyncClient


async def test_live_returns_envelope(client: AsyncClient) -> None:
    r = await client.get("/api/v1/health/live")
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True and body["data"] == {"status": "ok"}


async def test_validation_error_is_error_envelope(client: AsyncClient) -> None:
    r = await client.post("/api/v1/chat/messages", json={})
    assert r.status_code == 422
    body = r.json()
    assert body["success"] is False
    assert body["error"]["status"] == 422
    assert body["error"]["code"] == "validation_error"


async def test_not_found_is_error_envelope(client: AsyncClient) -> None:
    r = await client.get("/api/v1/projects/nope-none")
    assert r.status_code == 404
    body = r.json()
    assert body["success"] is False and body["error"]["code"] == "not_found"