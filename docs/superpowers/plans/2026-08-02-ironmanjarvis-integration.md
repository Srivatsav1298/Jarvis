# IronmanJARVIS Backend↔Frontend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the four target panels (Chat, System Monitoring, Notifications, Memory/Settings) to the FastAPI backend, replacing mock data with real API/WebSocket data and reusing them for future voice/tool/AI streaming.

**Architecture:** Approach A — thin frontend `api.ts` + `ws.ts` clients swapped into existing Zustand stores/services (UI untouched). Backend gains psutil metrics, conversations/preferences CRUD, a WS-first chat streaming pipeline keyed by `request_id`, namespaced/versioned WS events, notification publication, and a uniform REST `{success,data}` envelope.

**Tech Stack:** Backend: FastAPI, SQLAlchemy 2 async, Pydantic v2, Alembic, `uv`, `psutil`, pytest. Frontend: React 19, Vite, TypeScript, Zustand, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-02-ironmanjarvis-integration-design.md`

## Global Constraints

(Every task inherits these.)

- Backend app lives in `backend/`; frontend lives in repo root (`package.json`). Backend is Python 3.12+ via `uv`.
- **Layering (backend):** `api → services → repositories → models`. Services and repositories must NOT import models directly. Repositories import `app.models`. Services operate on dicts/schemas.
- Backend code style: keep each file `< 500` lines with a purpose docstring. Ruff: `line-length=100`, `select=["E","F","I","UP","B","SIM"]` (`[tool.ruff.lint]` in `backend/pyproject.toml`, with `extend-immutable-calls = ["fastapi.Depends","fastapi.Query"]`). PEP 695 generics in force (`Repository[T]`, `ListResponse[T]`).
- Backend run commands (`from backend/`): tests `uv run pytest -q`; lint `uv run ruff check .`. The ~200 pytest-asyncio `DeprecationWarning`s on CPython 3.14 are known and MUST NOT be chased or turned into errors.
- Frontend tests: `npm test` (Vitest). Frontend uses Zustand stores + existing `src/services/*` mock seams. Do not add new npm dependencies.
- Vite dev server proxies `/api` and `/ws` to `http://127.0.0.1:8000`.
- Single-user (no auth). GPU and temperature report `null`/unavailable — never fake.
- **REST envelope (Task 2, all endpoints):** success `{"success":true,"data":<model>}`; error `{"success":false,"error":{"type","title","status","code","detail"}}`.
- **WS envelope (Task 1, all messages):** `{"version":1,"type":"<namespaced>","payload":{...}}`.
- Career/Intelligence/Automation/Schedule/Workspace panels are OUT OF SCOPE — leave their mock data untouched.

---

### Task 1: Namespaced, versioned WebSocket protocol

**Files:**
- Create: `backend/app/websocket/events.py`
- Modify: `backend/app/websocket/protocol.py`
- Test: `backend/tests/websocket/test_protocol.py` (new)

**Interfaces:**
- Produces: `events.py` exports all namespaced WS type constants (single source of truth — frontend mirrors in `src/services/events.ts` later); `protocol.py` exports `envelope(type_, payload=None) -> dict` returning `{"version":1,"type":...,"payload":...}` and a `VERSION = 1` constant.

- [x] **Step 1: Write the failing test**

`backend/tests/websocket/test_events.py`:
```python
"""WebSocket protocol: version, envelope shape, and event-name constants."""
from app import events  # noqa: F401
from app.websocket import events as events
from app.websocket.protocol import VERSION, envelope

EVENT_CONSTS = [
    "CHAT_START", "CHAT_CHUNK", "CHAT_END", "CHAT_CANCELLED", "CHAT_ERROR",
    "CHAT_CANCEL", "AI_THINKING", "AI_STREAMING", "AI_CONTEXT_LOADED",
    "AI_TOOL_CALL", "SYSTEM_METRICS", "NOTIFICATION_CREATED", "MEMORY_UPDATED",
    "VOICE_START", "VOICE_END",
]


def test_envelope_versioned():
    msg = envelope("system.metrics", {"cpu": 1})
    assert msg["version"] == 1
    assert msg["type"] == "system.metrics"
    assert msg["payload"] == {"cpu": 1}
    assert envelope("pong")["payload"] == {}


def test_event_constants_defined_and_namespaced():
    for name in EVENT_CONSTS:
        assert hasattr(events, name), f"{name} missing"
        value = getattr(events, name)
        assert isinstance(value, str)
        assert ":" not in value


def test_chat_event_family():
    assert events.CHAT_START == "chat.started"
    assert events.CHAT_CHUNK == "chat.chunk"
    assert events.CHAT_END == "chat.end"
    assert events.SYSTEM_METRICS == "system.metrics"
    assert events.NOTIFICATION_CREATED == "notification.created"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/websocket/test_events.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.websocket.events'` (and `VERSION` missing later).

- [ ] **Step 3: Write the minimal implementation**

`backend/app/websocket/events.py`:
```python
"""Namespaced WebSocket message-type constants (single source of truth).

The frontend mirrors these in `src/services/events.ts`. When adding a message
type here, update the mirror and the README message contract.
"""

# --- client -> server ---
MSG_PING = "ping"
MSG_HEARTBEAT = "heartbeat"
CHAT_CANCEL = "chat.cancel"

# --- server -> client (chat / AI lifecycle) ---
CHAT_START = "chat.started"
AI_THINKING = "ai.thinking"
CHAT_CHUNK = "chat.chunk"
CHAT_END = "chat.end"
CHAT_CANCELLED = "chat.cancelled"
CHAT_ERROR = "chat.error"
AI_STREAMING = "ai.streaming"          # reserved (future)
AI_CONTEXT_LOADED = "ai.context_loaded"  # reserved
AI_TOOL_CALL = "ai.tool_call"            # reserved

# --- server -> client (channels) ---
SYSTEM_METRICS = "system.metrics"
NOTIFICATION_CREATED = "notification.created"
MEMORY_UPDATED = "memory.updated"  # emitted on memory writes

# --- legacy / generic ---
MSG_HELLO = "hello"
MSG_PONG = "pong"
MSG_BROADCAST = "broadcast"
MSG_ERROR = "error"
MSG_SYSTEM = "system"

# --- future voice ---
VOICE_START = "voice.started"
VOICE_END = "voice.finished"
```

`backend/app/websocket/protocol.py` (replace contents):
```python
"""WebSocket message envelope helpers and protocol version."""
from typing import Any

from app.websocket.events import (  # noqa: F401  (re-export for backward compat)
    AI_CONTEXT_LOADED,
    AI_STREAMING,
    AI_THINKING,
    AI_TOOL_CALL,
    CHAT_CANCEL,
    CHAT_CANCELLED,
    CHAT_CHUNK,
    CHAT_END,
    CHAT_ERROR,
    CHAT_START,
    MEMORY_UPDATED,
    MSG_BROADCAST,
    MSG_ERROR,
    MSG_HEARTBEAT,
    MSG_HELLO,
    MSG_PING,
    MSG_PONG,
    MSG_SYSTEM,
    NOTIFICATION_CREATED,
    SYSTEM_METRICS,
    VOICE_END,
    VOICE_START,
)

VERSION = 1


def envelope(type_: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    """Build a versioned WebSocket message envelope."""
    return {"version": VERSION, "type": type_, "payload": payload or {}}
```

- [ ] **Step 4: Run tests, then lint**

Run: `uv run pytest tests/websocket/test_events.py -q` → PASS.
Run: `uv run ruff check .` → clean.

- [ ] **Step 5: Commit**

```bash
git add backend/app/websocket/events.py backend/app/websocket/protocol.py backend/tests/websocket/test_events.py
git commit -m "feat(ws): namespaced event constants and versioned envelope"
```

---

### Task 2: REST response envelope

**Files:**
- Create: `backend/app/schemas/common.py` (modify)
- Create: `backend/app/api/envelope.py` (new)
- Modify: `backend/app/exceptions/handlers.py`
- Modify: every existing v1 router to wrap responses (list in Interfaces).

**Interfaces:**
- Produces: `app/api/envelope.ok(data) -> dict` → `{"success":True,"data":data}`; exception handlers emit `{"success":False,"error":{"type","title","status","code","detail"}}`. All v1 endpoints return `response_model=AnyBody` (defined below).

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/api/test_errors.py` and a new `backend/tests/api/test_envelope.py`:
```python
"""REST envelope: success => {success:true,data}, errors => {success:false,error}."""
from fastapi.testclient import TestClient

from app.config.settings import Settings
from app.main import create_app


def _app() -> TestClient:
    settings = Settings(
        _env_file=None, environment="testing", debug=True,
        database_url="sqlite+aiosqlite://", log_level="CRITICAL",
    )
    return TestClient(create_app(settings))


def test_live_returns_envelope():
    with _app() as client:
        r = client.get("/api/v1/health/live")
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True and body["data"] == {"status": "ok"}


def test_validation_error_is_error_envelope():
    with _app() as client:
        r = client.post("/api/v1/chat/messages", json={})  # missing message
        assert r.status_code == 422
        body = r.json()
        assert body["success"] is False
        assert body["error"]["status"] == 422
        assert body["error"]["code"] == "validation_error"


def test_not_found_is_error_envelope():
    with _app() as client:
        r = client.get("/api/v1/projects/nope-none")
        assert r.status_code == 404
        body = r.json()
        assert body["success"] is False and body["error"]["code"] == "not_found"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && uv run pytest tests/api/test_envelope.py -q`
Expected: FAIL — old shape has no `success` key.

- [x] **Step 3: Implement**

`backend/app/api/envelope.py`:
```python
"""Uniform REST response envelope helpers."""
from typing import Any


def ok(data: Any) -> dict[str, Any]:
    """Wrap a successful payload in the standard success envelope."""
    return {"success": True, "data": data}
```

Modify `backend/app/exceptions/handlers.py` — wrap every handler's `JSONResponse` content in the error envelope, e.g. the `validation_error_handler` return:
```python
return JSONResponse(
    status_code=422,
    content={"success": False, "error": {
        "type": "validation_error", "title": "Request validation failed",
        "status": 422, "code": "validation_error", "detail": exc.errors(),  # detail is example; keep consistent with existing handler
    }},
)
```
Note: preserve the exact `code`/`title`/`status`/`detail` each existing handler already computes; only add the `{"success": False, "error": ...}` wrapper. For each handler keep existing `(type,title,status,code,detail)` values inside `error`.

Update every v1 router method to `return ok(<previous return>)` and drop `response_model=` (endpoints now return generic dicts). Routers to update: `health.py`, `system.py`, `chat.py`, `memory.py`, `notifications.py`, `projects.py`, `reminders.py`, `settings.py`. Example (health_live):
```python
from app.api.envelope import ok
...
@router.get("/health/live")
async def health_live() -> dict:
    return ok({"status": "ok"})
```
For each list endpoint that previously returned `ListResponse[...]`, return `ok(ListResponse(...))`. For 204 endpoints keep `status_code=204` and return `Response(status_code=204)` (envelope not needed for empty delete).

- [ ] **Step 4: Run tests + lint**

Run: `uv run pytest -q` → all pass (update any older tests that asserted the pre-envelope shape).
Run: `uv run ruff check .` → clean.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/envelope.py backend/app/api/v1/routers/ backend/app/exceptions/handlers.py backend/tests/
git commit -m "feat(api): uniform {success,data}/{success,error} envelope"
```

---

### Task 3: Metrics provider + system metrics + WS metrics push

**Files:**
- Modify: `backend/pyproject.toml` (add `psutil`)
- Create: `backend/app/services/metrics.py`, `backend/app/schemas/system.py`, `backend/app/providers/metrics.py` (provider), `backend/tests/unit/test_metrics.py`, `backend/tests/api/test_system_metrics.py`
- Modify: `backend/app/api/v1/routers/system.py`, `backend/app/websocket/manager.py`, `backend/app/main.py`, `backend/app/core/constants.py`

**Interfaces:**
- Produces: `MetricsProvider` (ABC) with `snapshot() -> SystemMetrics`; `LocalMetricsProvider(psutil=None, monotonic=None)`; `SystemMetrics` schema with `cpu_percent: float`, `cpu_count`, `ram_percent`, `ram_used_gb`, `ram_total_gb`, `storage_percent`, `storage_used_gb`, `storage_total_gb`, `battery: BatteryMetrics{percent,charging,present} | None`, `gpu: None`, `temp: None`, `network: {connected,type,down_mbps,up_mbps,latency_ms,ssid}`, `api_latency_ms`, `collected_at`. `constants.py` `METRICS_PUSH_INTERVAL_SECONDS = 1.0`.
- ConnectionManager adds `subscribe(msg_type, handler)` and a `broadcast` unchanged.
- `snapshot()` computing down_mbps from `net_io_counters()` delta between calls (first call 0.0).

- [ ] **Step 1: Add psutil**

Modify `backend/pyproject.toml` `dependencies` list append `"psutil>=5.9,<6.0"`. Run `uv sync`.

- [ ] **Step 2: Write the failing tests**

`backend/tests/unit/test_metrics.py`:
```python
"""Unit tests for the metrics provider (psutil faked, clock injected)."""
from datetime import UTC, datetime
from types import SimpleNamespace

from app.providers.metrics import LocalMetricsProvider


class FakeClock:
    def __init__(self) -> None:
        self.t = 0.0

    def monotonic(self) -> float:
        self.t += 1.0
        return self.t


def fake_psutil(cpu=34.0, ram_pct=58.0, batt=None, recv=10_000_000, sent=2_000_000):
    return SimpleNamespace(
        cpu_percent=lambda interval=None: cpu,
        cpu_count=lambda: 8,
        virtual_memory=lambda: SimpleNamespace(
            percent=ram_pct, used=int(ram_pct * 10**7), total=100 * 10**7,
        ),
        disk_usage=lambda _p: SimpleNamespace(percent=30.0, used=312 * 2**30, total=1024 * 2**30),
        sensors_battery=lambda: batt,
        net_if_stats=lambda: {"en0": SimpleNamespace(isup=True)},
        net_io_counters=lambda: SimpleNamespace(bytes_recv=recv, bytes_sent=sent),
    )


def provider(psutil, clock) -> LocalMetricsProvider:
    return LocalMetricsProvider(psutil=psutil, monotonic=clock)


def test_cpu_and_ram():
    snap = provider_provider(fake_psutil()).snapshot()
    assert snap.cpu_percent == 34.0
    assert snap.cpu_count == 8
    assert snap.ram_percent == 58.0
    assert snap.ram_used_gb == 58.0          # int(58 * 1e7)/2**30 ≈ 58.0


def test_battery_none_and_placeholders():
    snap_up = provider(fake_psutil(batt=SimpleNamespace(percent=82, power_plugged=True))).snapshot()
    assert snap_up.battery.percent == 82 and snap_up.battery.charging is True
    assert snap_up.battery.present is True
    snap_down = provider(fake_psutil(batt=None)).snapshot()
    assert snap_down.battery.present is False and snap_down.battery.percent is None
    assert snap_down.gpu is None and snap_down.temp is None


def test_network_throughput():
    clock = FakeClock()
    p = provider(fake_psutil(recv=10_000_000, sent=2_000_000), clock=clock)
    first = p.snapshot()
    second = p.snapshot()
    assert first.network.down_mbps == second.network.down_mbps  # identical counters => 0 delta
    assert second.network.down_mbps == 0.0


def test_network_throughput_second_sample():
    clock = FakeClock()
    p = provider(fake_psutil(recv=10_000_000, sent=2_000_000), clock=clock)
    _ = p.snapshot()
    p._psutil = fake_psutil(recv=18_000_000, sent=6_000_000)
    sample = p.snapshot()
    assert sample.network.down_mbps == 64.0   # 8_000_000*8/1e6/1.0
    assert sample.network.up_mbps == 32.0     # 4_000_000*8/1e6/1.0
    assert sample.network.ssid == "en0" and sample.network.connected is True
```
Note: `LocalMetricsProvider` must accept injectable `psutil` and `monotonic` args so tests need no monkeypatching of module attributes.

`backend/tests/api/test_system_metrics.py`: GET `/api/v1/system/metrics` returns `{"success":True,"data":{...}}` with `cpu_percent` and `network` keys.

- [ ] **Step 3: Run to verify fail**

`cd backend && uv run pytest tests/unit/test_metrics.py -q` → FAIL (no module `app.providers.metrics`).

- [ ] **Step 4: Implement**

`backend/app/providers/metrics.py`:
```python
"""MetricsProvider abstraction and the local (psutil) implementation."""
from abc import ABC, abstractmethod
import time

from app.schemas.system import NetworkMetrics, SystemMetrics


class MetricsProvider(ABC):
    @abstractmethod
    async def snapshot(self) -> SystemMetrics: ...


class LocalMetricsProvider(MetricsProvider):
    """Reads real host metrics via an injectable psutil-like module."""

    def __init__(self, psutil=None, monotonic=None) -> None:
        import psutil as _psutil  # lazy import keeps module importable pre-install
        self._psutil = psutil or _psutil
        self._monotonic = monotonic if monotonic is not None else time.monotonic
        net = self._psutil.net_io_counters()
        self._prev = net
        self._prev_at = self._monotonic()

    async def snapshot(self) -> SystemMetrics:
        ps = self._psutil
        now = self._monotonic()
        net = ps.net_io_counters()
        dt = max(now - self._prev_at, 0.0001)
        down_mbps = max(0.0, (net.bytes_recv - self._prev.bytes_recv) * 8 / 1_000_000 / dt)
        up_mbps = max(0.0, (net.bytes_sent - self._prev.bytes_sent) * 8 / 1_000_000 / dt)
        self._prev, self._prev_at = net, now

        vm = ps.virtual_memory()
        du = ps.disk_usage("/")
        batt = ps.sensors_battery()
        iface, ifstats = None, None
        for name, stats in ps.net_if_stats().items():
            if stats.isup:
                iface, ifstats = name, stats
                break

        return SystemMetrics(
            cpu_percent=float(ps.cpu_percent(interval=None)),
            cpu_count=int(ps.cpu_count() or 0),
            ram_percent=float(vm.percent), ram_used_gb=round(vm.used / 2**30, 1),
            ram_total_gb=round(vm.total / 2**30, 1),
            storage_percent=float(du.percent), storage_used_gb=round(du.used / 2**30, 1),
            storage_total_gb=round(du.total / 2**30, 1),
            battery=BatteryMetrics(
                percent=batt.percent if batt else None,
                charging=batt.power_plugged if batt else None,
                present=batt is not None,
            ),
            gpu=None, temp=None,
            network=NetworkMetrics(
                connected=bool(ifstats and ifstats.isup),
                type="wifi" if (iface or "").startswith(("en0", "en1")) else "ethernet",
                down_mbps=round(down_mbps, 1), up_mbps=round(up_mbps, 1),
                latency_ms=None, ssid=iface,
            ),
            api_latency_ms=None,
            collected_at=datetime.now(UTC),
        )


def get_metrics_provider() -> MetricsProvider:
    return LocalMetricsProvider()
```

`backend/app/schemas/system.py`:
```python
"""System metric schemas."""
from datetime import datetime
from pydantic import Field
from app.schemas.common import APIModel


class NetworkMetrics(APIModel):
    connected: bool
    type: str = "unknown"
    down_mbps: float = 0.0
    up_mbps: float = 0.0
    latency_ms: float | None = None
    ssid: str | None = None


class BatteryMetrics(APIModel):
    percent: float | None = None
    charging: bool | None = None
    present: bool = False


class SystemMetrics(APIModel):
    cpu_percent: float
    cpu_count: int | None = None
    ram_percent: float
    ram_used_gb: float
    ram_total_gb: float
    storage_percent: float
    storage_used_gb: float
    storage_total_gb: float
    battery: BatteryMetrics | None = None
    gpu: float | None = None
    temp: float | None = None
    network: NetworkMetrics | None = None
    api_latency_ms: float | None = None
    collected_at: datetime
```

Modify `backend/app/api/v1/routers/system.py` to add:
```python
from fastapi import APIRouter, Request
from app.api.envelope import ok
from app.providers.metrics import get_metrics_provider

@router.get("/system/metrics")
async def system_metrics(request: Request) -> dict:
    provider = get_metrics_provider()
    started = time.perf_counter()
    snapshot = await provider.snapshot()
    snapshot.api_latency_ms = (time.perf_counter() - started) * 1000
    return ok(snapshot)
```

Add to `backend/app/websocket/manager.py`:
```python
def subscribe(self, msg_type: str, handler) -> None:
    self._handlers.setdefault(msg_type, []).append(handler)
```
initialize `self._handlers: dict[str, list] = {}` in `__init__`; in `handle()` loop after PING branch call each `handler(raw)`.

Add to `backend/app/core/constants.py`: `METRICS_PUSH_INTERVAL_SECONDS = 1.0`.

In `backend/app/main.py`, inside `lifespan` after scheduler wiring, register:
```python
provider = get_metrics_provider()
manager = app.state.websocket_manager

async def metrics_push() -> None:
    snapshot = await provider.snapshot()
    await manager.broadcast(envelope(SYSTEM_METRICS, snapshot.model_dump(mode="json")))

scheduler.register("metrics_push", metrics_push, METRICS_PUSH_INTERVAL_SECONDS)
```
(delta-gating per objective 2: skip broadcast if the change since last push is below a small delta; implement a small `diff` guard in the callback.)

- [ ] **Step 5: Run tests + lint + sync**

`uv sync`; `uv run pytest tests/unit/test_metrics.py tests/api/test_system_metrics.py -q` → PASS; `uv run ruff check .` → clean.
Verify migration unaffected: run `uv run pytest -q` full (still green).

- [ ] **Step 6: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock backend/app/
git commit -m "feat(metrics): psutil MetricsProvider, /system/metrics, WS metrics push"
```

---

### Task 4: Conversation model columns + migration

**Files:**
- Modify: `backend/app/models/conversation.py`
- Create: `backend/alembic/versions/<rev>_conversation_metadata.py`
- Modify: `backend/app/schemas/chat.py` (add `ConversationRead`,`MessageRead`,`ConversationCreate`,`ConversationUpdate`,`ConversationList`)
- Test: `backend/tests/unit/test_models.py`

**Interfaces:**
- Produces: `conversations` table has `pinned (Bool, default False)`, `last_model (str, null)`, `last_activity (DateTime, null)`, `message_count (int, default 0)`, `created_by (str, null)`.

- [x] **Step 1: Write the failing test**

Append to `backend/tests/unit/test_models.py`:
```python
def test_conversation_metadata_columns():
    cols = Conversation.__table__.columns
    assert "pinned" in cols and "message_count" in cols and "last_activity" in cols
    assert "created_by" in cols and "last_model" in cols
```

- [ ] **Step 2: Run to verify fail**

`cd backend && uv run pytest tests/unit/test_models.py -q` → FAIL (`'pinned' not in columns`).

- [ ] **Step 3: Implement model**

`backend/app/models/conversation.py` — add columns:
```python
class Conversation(TimestampMixin, Base):
    __tablename__ = "conversations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(String(255), default="New conversation")
    pinned: Mapped[bool] = mapped_column(server_default=text("false"))
    created_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_activity: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    messages: Mapped[list["Message"]] = relationship(back_populates="conversation", cascade="all, delete-orphan")
```
(import `boolean`, `text`, `Integer`, `DateTime`.)

- [ ] **Step 4: Migration**

Create `backend/alembic/versions/<rev>_conversation_metadata.py` (use `uuid4().hex[:12]` as rev id). Content adds 5 columns with `server_default` where appropriate and a `down_revision="cbe2c4024f3d"`. Example:
```python
revision: str = "<rev>"
down_revision: str | None = "cbe2c4024f3d"
branch_labels = ("conversation_metadata",)
depends_on = None

def upgrade() -> None:
    op.add_column("conversations", sa.Column("pinned", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.add_column("conversations", sa.Column("created_by", sa.String(length=100), nullable=True))
    op.add_column("conversations", sa.Column("last_model", sa.String(length=100), nullable=True))
    op.add_column("conversations", sa.Column("last_activity", sa.DateTime(timezone=True), nullable=True))
    op.add_column("conversations", sa.Column("message_count", sa.Integer(), server_default=sa.text("0"), nullable=False))

def downgrade() -> None:
    for c in ("message_count","last_activity","last_model","created_by","pinned"):
        op.drop_column("conversations", c)
```

- [ ] **Step 4: Verify migration applies; run tests + lint**

Apply to a scratch DB: `uv run alembic -c alembic.ini upgrade head` (uses a temp `database_url`), then `uv run pytest -q` and `uv run ruff check .`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/conversation.py backend/alembic/versions/<rev>_conversation_metadata.py backend/tests/unit/test_models.py
git commit -m "feat(models): conversation metadata columns + migration"
```

---

### Task 5: ConversationService + conversations router

**Files:**
- Create: `backend/app/services/conversations.py`, `backend/app/api/v1/routers/conversations.py`
- Modify: `backend/app/api/v1/router.py` (include router), `backend/app/repositories/implementations.py` (add `ConversationRepository.list_for_listing`, `MessageRepository.for_conversation`)
- Test: `backend/tests/api/test_conversations.py`, `backend/tests/unit/test_conversation_service.py`

**Interfaces:**
- Produces: `ConversationService(repos) -> ConversationService` with `list_conversations(limit,offset)`, `create_conversation(payload)`, `get_conversation(id)`, `update_conversation(id,payload)`, `delete_conversation(id)`.
- `ConversationRead`: `{id,title,pinned,created_by,last_model,last_activity,message_count,updated_at,created_at}`.
- `MessageRead`: `{id,conversation_id,role,content,created_at,tokens,latency_ms}`.

- [x] **Step 1: Write the failing test**

`backend/tests/api/test_conversations.py`:
```python
"""Conversation CRUD endpoints (enveloped)."""
from fastapi.testclient import TestClient

from app.config.settings import Settings
from app.main import create_app


def _client() -> TestClient:
    settings = Settings(
        _env_file=None, environment="testing", debug=True,
        database_url="sqlite+aiosqlite://", log_level="CRITICAL",
    )
    return TestClient(create_app(settings))


def test_conversation_lifecycle():
    with _client() as c:
        created = c.post("/api/v1/conversations", json={}).json()
        assert created["success"] is True
        cid = created["data"]["id"]
        assert created["data"]["message_count"] == 0

        listed = c.get("/api/v1/conversations").json()
        assert listed["success"] is True and any(x["id"] == cid for x in listed["data"]["items"])

        detail = c.get(f"/api/v1/conversations/{cid}").json()
        assert detail["data"]["messages"] == []

        patched = c.patch(f"/api/v1/conversations/{cid}", json={"title": "Renamed", "pinned": True}).json()
        assert patched["data"]["title"] == "Renamed" and patched["data"]["pinned"] is True

        assert c.delete(f"/api/v1/conversations/{cid}").status_code == 204
        assert c.get(f"/api/v1/conversations/{cid}").status_code == 404


def test_conversation_requires_valid_uuid_format_ok():
    with _client() as c:
        assert c.get("/api/v1/conversations/missing-id").status_code == 404
```
`backend/tests/unit/test_conversation_service.py`: unit-test `ConversationService.create` returns a `ConversationRead` with `message_count == 0`, and `update` with `{"pinned": True}` persists. Use the repo fakes from `tests/unit/test_services.py`.

- [ ] **Step 2: run to verify fail** — `uv run pytest tests/api/test_conversations.py -q` → FAIL (`/api/v1/conversations` 404).

- [x] **Step 3: Implement**

`backend/app/services/conversations.py`:
```python
"""ConversationService — CRUD and metadata for chat threads."""
from datetime import UTC, datetime
from typing import Any

from app.repositories.implementations import ConversationRepository, MessageRepository


class ConversationService:
    def __init__(self, conversations: ConversationRepository, messages: MessageRepository) -> None:
        self.conversations = conversations
        self.messages = messages

    async def list_conversations(self, *, limit: int, offset: int) -> tuple[list[dict], int]:
        rows = await self.conversations.list(limit=limit, offset=offset)
        total = await self.conversations.count()
        return [self._to_read(r) for r in rows], total

    async def create_conversation(self, *, title: str = "New conversation") -> dict:
        row = await self.conversations.create({"title": title})
        return self._to_read(row)

    async def get_conversation(self, conversation_id: str) -> dict | None:
        row = await self.conversations.get(conversation_id)
        if row is None:
            return None
        messages = await self.messages.for_conversation(conversation_id)
        return {**self._to_read(row), "messages": [self._to_msg(m) for m in messages]}

    async def update_conversation(self, conversation_id: str, data: dict[str, Any]) -> dict | None:
        row = await self.conversations.update(conversation_id, data)
        return self._to_read(row) if row else None

    async def delete_conversation(self, conversation_id: str) -> bool:
        return await self.conversations.delete(conversation_id)

    @staticmethod
    def _to_read(row: Any) -> dict:
        return {
            "id": row.id, "title": row.title, "pinned": bool(row.pinned),
            "created_by": row.created_by, "last_model": row.last_model,
            "last_activity": row.last_activity, "message_count": row.message_count,
            "created_at": row.created_at, "updated_at": row.updated_at,
        }

    @staticmethod
    def _to_msg(m: Any) -> dict:
        return {
            "id": m.id, "conversation_id": m.conversation_id, "role": m.role,
            "content": m.content, "tokens": m.tokens, "latency_ms": m.latency_ms,
            "created_at": m.created_at,
        }
```

`backend/app/api/v1/routers/conversations.py` (prefix `/conversations`): endpoints `GET ""` (list, `ListResponse`-wrapped), `POST ""` (201), `GET "/{conversation_id}"`, `PATCH "/{conversation_id}"` (body `ConversationUpdate {title?, pinned?}`), `DELETE "/{conversation_id}"` (204). Every response passes through `ok(...)`; mount in `app/api/v1/router.py` next to the other `include_router` calls. Add to `app/repositories/implementations.py`:
```python
class ConversationRepository(SQLAlchemyRepository[Conversation]):
    model = Conversation

    async def list(self, *, limit: int, offset: int) -> Sequence[Conversation]:
        result = await self.session.execute(
            select(Conversation).order_by(Conversation.updated_at.desc()).limit(limit).offset(offset)
        )
        return result.scalars().all()


class MessageRepository(SQLAlchemyRepository[Message]):
    model = Message

    async def for_conversation(self, conversation_id: str) -> Sequence[Message]:
        result = await self.session.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
        )
        return result.scalars().all()
```
(Reuse the existing `ConversationRepository`/`MessageRepository` classes; add only the two new methods/overrides above.)

- [ ] **Step 4: Run tests + lint** — `uv run pytest tests/api/test_conversations.py tests/unit/test_conversation_service.py -q` PASS; `uv run ruff check .` clean.

- [ ] **Step 5: Commit** — `feat(api): conversations CRUD (ConversationService)`.

---

### Task 6: ChatService streaming + cancellation over WS

**Files:**
- Create: `backend/app/services/mock_reply.py`, `backend/app/core/chat_stream_manager.py`
- Modify: `backend/app/services/chat.py`, `backend/app/api/v1/routers/chat.py`, `backend/app/main.py`
- Test: `backend/tests/api/test_chat_stream.py`, `backend/tests/unit/test_chat_service.py`

**Interfaces:**
- `POST /api/v1/chat` body `ChatRequest {message, conversation_id?, request_id}` → `ChatAccepted {request_id, conversation_id, model}`.
- `ChatStreamManager(conversations, messages, settings, broadcaster)` — `start(req) -> ChatAccepted`, `cancel(request_id) -> bool`; internally runs `asyncio.Task` emitting `CHAT_START → AI_THINKING → CHAT_CHUNK* → CHAT_END` (or `CHAT_CANCELLED`).
- `mock_reply_content(prompt) -> str` (deterministic, tokenized).
- `broadcaster` is an async callable `(type_, payload) -> None` (bound to `ws_manager.broadcast` with `envelope(...)` at the api layer).

- [x] **Step 1: Write the failing test**

`backend/tests/api/test_chat_stream.py` (WS-first):
```python
"""POST /chat streams over WS: chat.started → ai.thinking → chat.chunk* → chat.end."""
import asyncio
from fastapi.testclient import TestClient

from app.config.settings import Settings
from app.main import create_app


def _client() -> TestClient:
    return TestClient(create_app(Settings(
        _env_file=None, environment="testing", debug=True,
        database_url="sqlite+aiosqlite://", log_level="CRITICAL",
    )))


def test_chat_streams_over_websocket():
    with _client() as c:
        with c.websocket_connect("/ws") as ws:
            hello = ws.receive_json()
            assert hello["type"] == "hello"
            accepted = c.post(
                "/api/v1/chat",
                json={"message": "Summarize today", "request_id": "req-1"},
            ).json()
            assert accepted["success"] is True
            rid = accepted["data"]["request_id"]
            cid = accepted["data"]["conversation_id"]
            types: list[str] = []
            while True:
                msg = ws.receive_json()
                types.append(msg["type"])
                assert msg["payload"].get("request_id", "req-1") == rid or msg["type"] == "ai.thinking"
                if msg["type"] == "chat.end":
                    assert msg["payload"]["conversation_id"] == cid
                    break
            assert "chat.started" in types and "ai.thinking" in types and "chat.chunk" in types
            detail = c.get(f"/api/v1/conversations/{cid}").json()
            roles = [m["role"] for m in detail["data"]["messages"]]
            assert roles == ["user", "assistant"]
            assert detail["data"]["message_count"] == 2


def test_cancel_stops_stream_and_emits_chat_cancelled():
    with _client() as c:
        with c.websocket_connect("/ws") as ws:
            ws.receive_json()  # hello
            accepted = c.post("/api/v1/chat", json={"message": "x", "request_id": "req-2"}).json()
            rid = accepted["data"]["request_id"]
            ws.send_json({"version": 1, "type": "chat.cancel", "payload": {"request_id": rid}})
            cancelled = False
            while True:
                msg = ws.receive_json()
                if msg["type"] == "chat.cancelled" and msg["payload"].get("request_id") == rid:
                    cancelled = True
                    break
                if msg["type"] == "chat.end":
                    break
            assert cancelled
```
Note: the mock reply is short, so `chat.end` may race the cancel; in that case assert `cancelled or saw chat.end` — the test above is the intended contract; adjust timing assertions only if the race is inherent.

- [ ] **Step 2: run to verify fail** — `uv run pytest tests/api/test_chat_stream.py -q` → FAIL (no `/api/v1/chat`, and WS loop never yields `chat.*`).

- [x] **Step 3: Implement**

`backend/app/services/mock_reply.py`:
```python
"""Deterministic placeholder assistant reply for streaming."""
import re


def mock_reply_content(prompt: str) -> str:
    if re.search(r"\b(hi|hello|hey)\b", prompt.lower()):
        return "Good morning, Sir. All systems are nominal. How can I help first?"
    if re.search(r"\b(status|health|how.*doing)\b", prompt.lower()):
        return "All systems nominal, Sir. CPU and memory are within nominal ranges."
    return f"Understood, Sir. Processing “{prompt[:80]}” — response pipeline pending."
```

`backend/app/core/chat_stream_manager.py`:
```python
"""ChatStreamManager — runs per-request streaming tasks and cancellation."""
import asyncio
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

from app.config.settings import Settings
from app.repositories.implementations import ConversationRepository, MessageRepository
from app.schemas.chat import ChatAccepted, ChatRequest
from app.services.mock_reply import mock_reply_content
from app.websocket.events import (
    AI_THINKING, CHAT_CANCELLED, CHAT_CHUNK, CHAT_END, CHAT_START,
)
from app.websocket.protocol import envelope

Broadcaster = Callable[[str, dict], Awaitable[None]]


class ChatStreamManager:
    def __init__(self, conversations, messages, settings, broadcaster) -> None:
        self.conversations = conversations
        self.messages = messages
        self.settings = settings
        self.broadcaster = broadcaster
        self._tasks: dict[str, asyncio.Task] = {}

    async def start(self, request: ChatRequest) -> ChatAccepted:
        if request.request_id in self._tasks:
            existing = self._tasks[request.request_id]
            return ChatAccepted(request_id=request.request_id, conversation_id=existing.conversation_id, model=self.settings.ai_model)
        conversation_id = request.conversation_id
        if conversation_id is None:
            conversation = await self.conversations.create({"title": request.message[:60]})
            conversation_id = conversation.id
        await self.messages.create({"conversation_id": conversation_id, "role": "user", "content": request.message})
        task = asyncio.create_task(self._run(request.request_id, conversation_id, request.message))
        self._tasks[request.request_id] = task
        return ChatAccepted(request_id=request.request_id, conversation_id=conversation_id, model=self.settings.ai_model)

    async def cancel(self, request_id: str) -> bool:
        task = self._tasks.pop(request_id, None)
        if task is None:
            return False
        task.cancel()
        await self.broadcaster(CHAT_CANCELLED, {"request_id": request_id})
        return True

    async def _run(self, request_id: str, conversation_id: str, prompt: str) -> None:
        started = datetime.now(UTC)
        reply = mock_reply_content(prompt)
        tokens = [t for t in reply.split(" ") if t]
        await self.broadcaster(CHAT_START, {"request_id": request_id, "conversation_id": conversation_id, "model": self.settings.ai_model})
        await self.broadcaster(AI_THINKING, {"request_id": request_id})
        await asyncio.sleep(0)
        acc = []
        for token in tokens:
            await asyncio.sleep(0.01)
            acc.append(token)
            await self.broadcaster(CHAT_CHUNK, {"request_id": request_id, "text": token})
        full = " ".join(acc)
        latency_ms = int((datetime.now(UTC) - started).total_seconds() * 1000)
        row = await self.messages.create({
            "conversation_id": conversation_id, "role": "assistant", "content": full,
            "latency_ms": latency_ms, "tokens": len(tokens),
        })
        await self.conversations.update(conversation_id, {
            "message_count": len(tokens) + 1,
            "last_activity": datetime.now(UTC), "last_model": self.settings.ai_model,
        })
        await self.broadcaster(CHAT_END, {
            "request_id": request_id, "conversation_id": conversation_id, "message_id": row.id,
            "model": self.settings.ai_model, "latency_ms": latency_ms, "token_count": len(tokens),
        })
        self._tasks.pop(request_id, None)
```
Note on message_count: count user message + assistant message = 2. Set `message_count` to the actual stored count (`await self.messages.count_for(conversation_id)` or `2` for this turn) — implement `MessageRepository.count_for(conversation_id)` and use it.

`backend/app/schemas/chat.py` — add:
```python
class ChatRequest(APIModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = None
    request_id: str = Field(min_length=1, max_length=64)


class ChatAccepted(APIModel):
    request_id: str
    conversation_id: str
    model: str
```
`backend/app/api/v1/routers/chat.py` — replace `POST /messages` logic (keep it) and add:
```python
@router.post("", response_model=dict)
async def start_chat(
    payload: ChatRequest,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    manager: ChatStreamManager = request.app.state.chat_manager
    accepted = await manager.start(payload)
    return ok(accepted)
```
In `backend/app/main.py` lifespan: build
```python
manager = app.state.websocket_manager
app.state.chat_manager = ChatStreamManager(
    conversations=ConversationRepository(session),   # from a fresh session factory, not one shared request
    messages=MessageRepository(session),
    settings=settings,
    broadcaster=lambda type_, payload: manager.broadcast(envelope(type_, payload)),
)
```
and in the `/ws` endpoint register `chat.cancel`:
```python
async def cancel_chat(raw):
    rid = (raw.get("payload") or {}).get("request_id")
    if rid:
        await app.state.chat_manager.cancel(rid)
manager.subscribe("chat.cancel", cancel_chat)
```
(Each task must open its own session via the app session factory rather than reusing a request-scoped session; construct the manager lazily using `app.state.session_factory` inside `_run`/`start` or create a session per task.)

- [ ] **Step 4: Run tests + lint** — `uv run pytest tests/api/test_chat_stream.py tests/unit/test_chat_service.py -q` PASS; `uv run ruff check .` clean.

- [ ] **Step 5: Commit** — `feat(chat): WS streaming with request_id + cancellation`.

---

### Task 7: Notification publish + preferences + memory-kind filter

**Files:**
- Modify: `backend/app/services/notifications.py` (add `publish`), `backend/app/api/v1/routers/notifications.py`, `backend/app/services/notifications.py`, `backend/app/schemas/notification.py`; create `backend/app/providers/notifier.py` (sink). 
- Create: `backend/app/api/v1/routers/preferences.py`, `backend/app/services/preferences.py`, `backend/app/schemas/preferences.py`, modify `backend/app/repositories/implementations.py` (upsert), `backend/app/api/v1/routers/memory.py` (kind filter).
- Test: `backend/tests/api/test_preferences.py`, `backend/tests/api/test_notifications.py` (broadcast), `backend/tests/api/test_memory.py`.

**Interfaces:**
- `NotificationService.publish(payload, publisher: NotificationPublisher)` persists + calls `publisher.publish(read)` (WS broadcast, future email/logs via extra publishers).
- `GET/PUT /api/v1/preferences` → `{success,data:{key:value}}`.

- [ ] Steps 1–5: TDD + implementation following prior tasks; commits:
  - `feat(notif): publish() single entry with WS broadcast` 
  - `feat(api): preferences CRUD and memory kind filter`.

---

### Task 8: Backend docs + full suite green

**Files:**
- Modify: `backend/README.md` (endpoints, WS contract, envelope), `backend/docs/ARCHITECTURE.md` (updated layering/publish), `backend/docs/ROADMAP.md`.
- Test: backend whole suite + `ruff`.

- [ ] Update README endpoint list (health, system/info+metrics, chat POST + WS stream, conversations, notifications, preferences, memory, settings, projects, reminders), WS message table, REST envelope, run/curl examples.
- [ ] Run `cd backend && uv run pytest -q` (all green) and `uv run ruff check .`.
- [ ] Commit `docs(backend): integration endpoints, WS protocol, envelope`.

---

### Task 9: Frontend — API client + envelopes + retry (+ Vite proxy)

**Files:**
- Modify: `vite.config.ts`; Create: `src/services/api.ts`, `src/types/api.ts`.
- Test: `src/test/api.test.ts`.

**Interfaces:**
- `API_BASE` and typed helpers `api.get/post/patch/put/del`.
- `request<T>(path, {method, body, signal, retries})`: prefix `/api/v1`, call `fetch`, treat non-2xx by trying to read the `{success,error}` envelope; unwrap `body.data` on success; throw `ApiError`; retry network errors + `status>=500` (default 3 attempts) with backoff `250 * 2**attempt ms` (cap 2s); 8s timeout via `AbortSignal.timeout(8000)` combined with the caller signal.
- `ApiError { status, code, title, detail } extends Error`.
- `vite.config.ts` adds `server.proxy` for `/api` and `/ws`.

- [x] **Step 1: Write the failing test**

`src/test/api.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '@/services/api'

const ok = (data: unknown, init = {}) =>
  new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'content-type': 'application/json' } })
const bad = (status: number, code: string) =>
  new Response(JSON.stringify({ success: false, error: { status, code, title: code } }), { status })

describe('api', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('unwraps the success envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({ hello: 1 }))
    const data = await api.get<{ hello: number }>('/health/live')
    expect(data).toEqual({ hello: 1 })
  })

  it('throws ApiError on an error envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(bad(404, 'not_found'))
    await expect(api.get('/none')).rejects.toBeInstanceOf(ApiError)
  })

  it('retries a 503 then succeeds', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(bad(503, 'unavailable'))
      .mockResolvedValueOnce(ok({ ok: true }))
    expect(await api.get('/health/ready')).toEqual({ ok: true })
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
```

- [x] **Step 2: run to verify fail** — `npm run test` fails (`api` undefined).

- [x] **Step 3: Implement**

`src/types/api.ts`:
```ts
export interface ApiErrorBody {
  type: string
  title: string
  status: number
  code: string
  detail?: unknown
}
export class ApiError extends Error {
  status: number
  code: string
  title: string
  detail?: unknown
  constructor(body: ApiErrorBody) {
    super(body.code)
    this.name = 'ApiError'
    this.status = body.status
    this.code = body.code
    this.title = body.title
    this.detail = body.detail
  }
}
```

`src/services/api.ts`:
```ts
import { ApiError, type ApiErrorBody } from '@/types/api'

export const API_BASE = import.meta.env.VITE_API_URL ?? ''

interface RequestOpts {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  retries?: number
}

interface OkEnvelope<T> { success: true; data: T }
interface ErrEnvelope { success: false; error: ApiErrorBody }

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms)
    if (signal) signal.addEventListener('abort', () => { clearTimeout(t); resolve() }, { once: true })
  })

async function unwrap<T>(res: Response): Promise<T> {
  let json: OkEnvelope<T> | ErrEnvelope
  try {
    json = await res.json()
  } catch {
    throw new ApiError({ type: 'http_error', title: res.statusText, status: res.status, code: 'http_error' })
  }
  if (json.success) return json.data
  throw new ApiError(json.error)
}

const RETRY_MAX = 8000

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { method = 'GET', body, signal, retries = 3 } = opts
  const url = `${API_BASE}/api/v1${path}`
  const inner = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(8000)])
    : AbortSignal.timeout(8000)

  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: inner,
      })
      return await unwrap<T>(res)
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) throw err // 4xx: never retry
      if (attempt >= retries - 1) throw err
      await sleep(Math.min(RETRY_MAX, 250 * 2 ** attempt), signal)
    }
  }
}
```

Add helpers so `api` exposes typed verbs, e.g.
```ts
export const api = {
  get: <T>(path: string, opts?: RequestOpts) => request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: RequestOpts) => request<T>(path, { ...opts, body, method: 'POST' }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOpts) => request<T>(path, { ...opts, body, method: 'PATCH' }),
  put: <T>(path: string, body?: unknown, opts?: RequestOpts) => request<T>(path, { ...opts, body, method: 'PUT' }),
  del: <T>(path: string, opts?: RequestOpts) => request<T>(path, { ...opts, method: 'DELETE' }),
}
```

- [x] **Step 4: run tests + tsc** — `npm run test` (api tests pass) and `npm run typecheck` clean.

- [ ] **Step 5: Commit** — `feat(web): API client with envelope + retry`.

---

### Task 10: Frontend — WS client + connectionStore + events

**Files:**
- Create: `src/services/events.ts`, `src/services/ws.ts`, `src/stores/connectionStore.ts`.
- Modify: `src/layouts/Shell.tsx` (invoke `connect()` once).
- Test: `src/test/ws.test.ts`.

**Interfaces:**
- `events.ts` mirrors backend `app/websocket/events.py` named constants.
- `WsClient` (singleton export `socket`): `connect(url='/ws')`, `close()`, `subscribe(type, cb)->unsubscribe`, `get status(): 'idle'|'connecting'|'open'|'reconnecting'|'closed'`, `get latencyMs()`, `get reconnectCount()`, `get lastPingAt()`; sends `{version:1,type:'ping',payload:{ts}}` every 30s while open; reconnect backoff 1000ms→30000ms.
- `connectionStore` (zustand): `{ api:'ok'|'error', ws: status, latency, reconnectCount, lastPingAt, setWsStatus, setLatency, setApiStatus, setReconnectCount }`.

- [x] **Step 1: Write the failing test**

`src/test/ws.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { socket } from '@/services/ws'

class FakeWS {
  static instances: FakeWS[] = []
  readyState = 0
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  sent: string[] = []
  constructor() { FakeWS.instances.push(this) }
  send(d: string) { this.sent.push(d) }
  close() {}
  // helpers
  open() { this.readyState = 1; this.onopen?.() }
  message(obj: unknown) { this.onmessage?.({ data: JSON.stringify(obj) }) }
  closeConn() { this.onclose?.() }
}

beforeEach(() => { FakeWS.instances = [] })
afterEach(() => { socket.close(); vi.restoreAllMocks() })

it('connects, sends ping, computes latency from pong', async () => {
    vi.stubGlobal('WebSocket', FakeWS)
    socket.connect('/ws')
    const ws = FakeWS.instances[0]
    ws.open()
    expect(socket.status).toBe('open')
    expect(socket.latencyMs).toBeNull()
    const ping = JSON.parse(ws.sent[0])
    expect(ping.type).toBe('ping')
    const pongTs = Date.now() - 12
    ws.message({ version: 1, type: 'pong', payload: { ts: pongTs } })
    expect(socket.latencyMs).toBeGreaterThanOrEqual(12)
    expect(socket.lastPingAt).not.toBeNull()
    vi.unstubAllGlobals()
  })

  it('reconnects on close', () => {
    vi.stubGlobal('WebSocket', FakeWS)
    socket.connect('/ws')
    FakeWS.instances[0].open()
    FakeWS.instances[0].closeConn()
    expect(socket.status).toBe('reconnecting')
    expect(socket.reconnectCount).toBe(1)
    vi.unstubAllGlobals()
  })
})
```
(Use `vi.useFakeTimers()` to advance the heartbeat and backoff deterministically rather than real `setTimeout`.)

- [ ] **Step 2: run to verify fail** — `npm run test` fails (`// @/services/ws`).

- [x] **Step 3: Implement**

`src/services/events.ts`:
```ts
// Mirror of backend/app/websocket/events.py (single source of truth: backend)
export const MSG_PING = 'ping'
export const MSG_PONG = 'pong'
export const MSG_HELLO = 'hello'
export const MSG_HEARTBEAT = 'heartbeat'
export const MSG_BROADCAST = 'broadcast'
export const MSG_ERROR = 'error'
export const MSG_SYSTEM = 'system'
export const CHAT_START = 'chat.started'
export const CHAT_CHUNK = 'chat.chunk'
export const CHAT_END = 'chat.end'
export const CHAT_CANCELLED = 'chat.cancelled'
export const CHAT_ERROR = 'chat.error'
export const CHAT_CANCEL = 'chat.cancel'
export const AI_THINKING = 'ai.thinking'
export const SYSTEM_METRICS = 'system.metrics'
export const NOTIFICATION_CREATED = 'notification.created'
export const MEMORY_UPDATED = 'memory.updated'
export const VOICE_START = 'voice.started'
export const VOICE_END = 'voice.finished'
export const WS_V=  1
```

`src/services/ws.ts`:
```ts
import { MSG_PING, MSG_PONG } from '@/services/events'

export type WsStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed'
type Handler = (payload: Record<string, unknown>, raw: any) => void

const RECONNECT_MIN = 1000
export const RECONNECT_MAX = 30000

export class WsClient {
  ws: WebSocket | null = null
  private url = ''
  private wantOpen = false
  private _status: WsStatus = 'idle'
  private _reconnectCount = 0
  private _latencyMs: number | null = null
  private _lastPingAt: number | null = null
  private timer: number | null = null
  private handlers = new Map<string, Set<Handler>>()

  get status() { return this._status }
  get reconnectCount() { return this._reconnectCount }
  get latencyMs() { return this._latencyMs }
  get lastPingAt() { return this._lastPingAt }

  connect(url = '/ws') {
    this.url = url
    this.wantOpen = true
    this.open()
  }
  close() {
    this.wantOpen = false
    if (this.timer) window.clearInterval(this.timer)
    this.ws?.close()
  }
  subscribe(type: string, fn: Handler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set())
    this.handlers.get(type)!.add(fn)
    return () => this.handlers.get(type)?.delete(fn)
  }
  sendRaw(obj: unknown) { this.ws?.send(JSON.stringify(obj)) }
  sendPing() {
    const ts = Date.now()
    this.sendRaw({ version: WS_V, type: MSG_PING, payload: { ts } })
  }
  _onPong(payload: { ts?: number }) {
    if (payload.ts != null) { this._latencyMs = Date.now() - payload.ts; this._lastPingAt = Date.now() }
  }
  private open() {
    this._status = this.wantOpen ? 'connecting' : 'closed'
    const ws = new WebSocket(this.url)
    this.ws = ws
    ws.onopen = () => {
      this._status = 'open'
      ws.send(JSON.stringify({ version: WS_V, type: MSG_PING, payload: { ts: Date.now() } }))
      this.timer = window.setInterval(() => this.sendPing(), 30_000)
    }
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.type === MSG_PONG) this._onPong(msg.payload)
      this.handlers.get(msg.type)?.forEach((h) => h(msg.payload, msg))
    }
    ws.onclose = () => {
      if (this.timer) window.clearInterval(this.timer)
      if (!this.wantOpen) { this._status = 'closed'; return }
      this._status = 'reconnecting'
      this._reconnectCount += 1
      const delay = Math.min(RECONNECT_MAX, RECONNECT_MIN * 2 ** this._reconnectCount)
      this.timer = window.setTimeout(() => this.open(), delay)
    }
  }
}

export const socket = new WsClient()
```

- [x] **Step 4: run + typecheck** — `npm run test` and `npm run typecheck` green; lint clean.

- [ ] **Step 5: Commit** — `feat(web): WS client + connection store + event constants`.

---

### Task 11: Frontend — wire metricsStore to /system/metrics + WS

**Files:**
- Modify: `src/stores/metricsStore.ts`.
- Test: `src/test/metrics.test.ts`.

- [ ] Step 1 tests (mock `api.get` and ws event; store backfills snapshot then applies WS `system.metrics`; falls back to poll when ws closed).
- [ ] Step 2 impl: `start()` → `refresh()` (api snapshot) + subscribe `system.metrics`; on message, compute `Metrics` from `SystemMetrics` mapping, append to 60-ring; if ws disconnected → `poll()` interval (1s).
- Sensor mic/camera/location remain browser-derived.
- [ ] Commit `feat(metrics): live system metrics via API + WS`.

---

### Task 12: Frontend — wire chat streaming + conversationState

**Files:**
- Modify: `src/services/chat.ts` (drop mock; export `streamChat`), `src/stores/chatStore.ts`.
- Test: `src/test/chat.test.ts` (mock both `api.post /chat` and ws `chat.*`).

- [x] `streamChat({conversationId, prompt, requestId, signal})` → POST `/chat`, subscribe `chat.*`, yield token strings; on `signal` abort → send `chat.cancel`.
- [x] `chatStore` seeds via `GET /conversations`; send path uses `streamChat`; delete/pin via API; `new conversation` → POST `/conversations`.
- [ ] Update tests + commit `feat(chat): real streaming over WS`.

---

### Task 13: Frontend — wire notifications + memory + settings

**Files:**
- Modify: `src/features/shared/NotificationCenter.tsx`, `src/stores/notificationStore.ts` (new), `src/stores/memoryStore.ts`, `src/services/notificationStore…`.
- Create: `src/stores/notificationStore.ts`.
- Test: `src/test/notificationStore.test.ts`, `src/test/memoryStore.test.ts`.

- [x] NotificationCenter loads `GET /notifications`, subscribes `notification.created`, map severity→toast, mark-read `PATCH`; unread badge from store.
- [x] memoryStore loads `GET /projects`, `GET /preferences`, `GET /memory/entries?kind=` ; localStorage mock seed removed; settings GET/PATCH.
- [ ] Commit `feat: wire notifications, memory, settings to backend`.

---

### Task 14: Full-stack E2E verification + final docs

- [x] Boot backend (`cd backend && uv run uvicorn app.main:app --port 8000`), boot frontend (`npm run dev`). Probe: health envelope, `/system/metrics`, POST `/chat` + WS stream, notification broadcast, conversation CRUD, preferences. Verify WS heartbeat/reconnect, the metrics push cadence.
- [x] Run full backend and frontend suites; `docs` update (integration guide with run + curl + WS examples).
- [ ] Final commit `chore: end-to-end verification + integration docs`.