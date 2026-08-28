"""POST /chat streams over WS: chat.started → ai.thinking → chat.chunk* → chat.end."""
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from app.config.settings import Settings
from app.database.base import Base
from app.main import create_app


def _client(tmp_path) -> TestClient:
    db_path = tmp_path / "chat_stream.db"
    sync_engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(sync_engine)
    sync_engine.dispose()
    settings = Settings(
        _env_file=None,
        environment="testing",
        debug=True,
        database_url=f"sqlite+aiosqlite:///{db_path}",
        log_level="CRITICAL",
    )
    return TestClient(create_app(settings))


def test_chat_streams_over_websocket(tmp_path) -> None:
    with _client(tmp_path) as client, client.websocket_connect("/ws") as ws:
            hello = ws.receive_json()
            assert hello["type"] == "hello"
            accepted = client.post(
                "/api/v1/chat",
                json={"message": "Summarize today", "request_id": "req-1"},
            ).json()
            assert accepted["success"] is True
            cid = accepted["data"]["conversation_id"]
            types: list[str] = []
            while True:
                msg = ws.receive_json()
                types.append(msg["type"])
                if msg["type"] == "chat.end":
                    assert msg["payload"]["conversation_id"] == cid
                    break
            assert "chat.started" in types
            assert "ai.thinking" in types
            assert "chat.chunk" in types
            detail = client.get(f"/api/v1/conversations/{cid}").json()
            roles = [m["role"] for m in detail["data"]["messages"]]
            assert roles == ["user", "assistant"]
            assert detail["data"]["message_count"] == 2


def test_cancel_stops_stream_and_emits_chat_cancelled(tmp_path) -> None:
    with _client(tmp_path) as client, client.websocket_connect("/ws") as ws:
            ws.receive_json()  # hello
            accepted = client.post(
                "/api/v1/chat", json={"message": "x", "request_id": "req-2"}
            ).json()
            rid = accepted["data"]["request_id"]
            ws.send_json(
                {"version": 1, "type": "chat.cancel", "payload": {"request_id": rid}}
            )
            cancelled = False
            while True:
                msg = ws.receive_json()
                if (
                    msg["type"] == "chat.cancelled"
                    and msg["payload"].get("request_id") == rid
                ):
                    cancelled = True
                    break
                if msg["type"] == "chat.end":
                    break
            assert cancelled