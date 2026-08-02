"""Integration test for the /ws endpoint over a real TestClient lifespan."""
from fastapi.testclient import TestClient

from app.config.settings import Settings
from app.main import create_app


def test_websocket_hello_and_ping_pong(tmp_path) -> None:
    settings = Settings(
        _env_file=None,
        environment="testing",
        debug=True,
        database_url=f"sqlite+aiosqlite:///{tmp_path / 'ws.db'}",
        log_level="CRITICAL",
        cors_origins=["http://localhost:5173"],
    )
    app = create_app(settings)
    with TestClient(app) as client, client.websocket_connect("/ws") as ws:
        hello = ws.receive_json()
        assert hello["type"] == "hello"
        ws.send_json({"type": "ping", "ts": 42})
        pong = ws.receive_json()
        assert pong["type"] == "pong"
        assert pong["payload"]["ts"] == 42
