"""Notification publish + WebSocket broadcast tests."""
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from app.config.settings import Settings
from app.database.base import Base
from app.main import create_app


def _client(tmp_path) -> TestClient:
    db_path = tmp_path / "notifications.db"
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


def test_notification_crud_and_publish(tmp_path) -> None:
    with _client(tmp_path) as client:
        created = client.post(
            "/api/v1/notifications",
            json={"title": "Reminder due", "severity": "warn"},
        )
        assert created.status_code == 201
        body = created.json()
        assert body["success"] is True
        nid = body["data"]["id"]
        assert body["data"]["severity"] == "warn"

        listed = client.get("/api/v1/notifications").json()
        assert listed["data"]["total"] == 1

        marked = client.patch(f"/api/v1/notifications/{nid}/read?read=true").json()
        assert marked["data"]["read"] is True

        assert client.delete(f"/api/v1/notifications/{nid}").status_code == 204


def test_notification_broadcasts_over_websocket(tmp_path) -> None:
    with _client(tmp_path) as client, client.websocket_connect("/ws") as ws:
        ws.receive_json()  # hello
        client.post("/api/v1/notifications", json={"title": "Hi there"})
        received = ws.receive_json()
        assert received["type"] == "notification.created"
        assert received["payload"]["title"] == "Hi there"