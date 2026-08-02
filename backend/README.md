# IronmanJARVIS Backend

Async FastAPI backend for the IronmanJARVIS personal AI assistant. This repository
contains the versioned REST API, a `/ws` WebSocket endpoint, Alembic async
migrations, a background scheduler, and layered repository/service code — with
no AI logic wired in yet (mock/deterministic responses for chat and memory).

## Architecture Summary

```
Client ──REST──▶ api/v1 routers ──▶ services ──▶ repositories ──▶ models ──▶ database
    │                                                                         ▲
    └────WebSocket /ws──▶ ConnectionManager                                    │
                                          ▲                                   │
                                          └──── app.state.session_factory ─────┘
```

- **Routers** (`app/api/v1/routers/`) parse/validate requests, then delegate to services.
- **Services** (`app/services/`) hold business logic and depend on repositories.
- **Repositories** (`app/repositories/`) own data access against the async session.
- **DI** (`app/dependencies/`) provides the per-request async session built by the
  app lifespan from `app.state.session_factory`.
- **Scheduler** (`app/scheduler/`) runs periodic background tasks (e.g. reminder sweep).
- **WebSocket** (`app/websocket/`) tracks live clients with a `ConnectionManager`.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full dependency graph and
request lifecycle.

## Directory Map

| Path | Purpose |
|------|---------|
| `app/` | Application package root |
| `app/api/v1/` | Versioned REST API: router aggregation + endpoint modules |
| `app/api/v1/routers/` | One router per resource (health, system, chat, memory, notifications, reminders, settings, projects) |
| `app/core/` | Shared constants and environment enums |
| `app/config/` | Pydantic `Settings` (env + `.env`) and settings dependency |
| `app/database/` | Declarative `Base`, async engine and session factory |
| `app/models/` | SQLAlchemy ORM models (8 models registered on `Base.metadata`) |
| `app/schemas/` | Pydantic request/response schemas incl. `ListResponse[T]` |
| `app/repositories/` | Generic `Repository` interface + SQLAlchemy implementations |
| `app/services/` | Business-logic layer (chat, notifications, projects, reminders, settings, system) |
| `app/tools/` | `ToolRegistry` for future AI-callable tools |
| `app/memory/` | `MemoryManager` — CRUD over memory entries plus a search stub |
| `app/websocket/` | `ConnectionManager` and message envelope helpers |
| `app/scheduler/` | Minimal asyncio periodic-task scheduler |
| `app/utils/` | Logging, id generation, UTC datetime helpers |
| `app/middleware/` | CORS setup and request-logging middleware |
| `app/dependencies/` | DI providers (`get_db_session`, settings) |
| `app/exceptions/` | Domain error hierarchy + uniform HTTP error handlers |
| `alembic/` | Async Alembic migration environment and revision scripts |
| `tests/` | pytest suite (api, unit, websocket) |

## Prerequisites

- **Python ≥ 3.12** (the project targets `py312` and requires `>=3.12`)
- **uv** — the package/venv manager. Install it with
  `curl -LsSf https://astral.sh/uv/install.sh | sh` if you don't have it.

## Setup

```bash
cd backend
uv sync
```

`uv sync` creates a `.venv` and installs runtime + dev dependencies from
`uv.lock`. For local development the app runs against a SQLite database — no
external service is required.

### Environment configuration

Copy the example env file and adjust values:

```bash
cp .env.example .env
```

All settings load from environment variables or `.env` via Pydantic
(`app/config/settings.py`). The `.env` file is gitignored.

| Variable | Default | Description |
|----------|---------|-------------|
| `ENVIRONMENT` | `development` | Runtime environment (`development`, `production`, `testing`) |
| `DEBUG` | `false` | FastAPI debug mode |
| `APP_NAME` | `IronmanJARVIS` | Application display name |
| `APP_VERSION` | `0.1.0` | Application version |
| `HOST` | `127.0.0.1` | Bind host for the ASGI server |
| `PORT` | `8000` | Bind port for the ASGI server |
| `API_PREFIX` | `/api/v1` | REST API prefix |
| `DATABASE_URL` | `sqlite+aiosqlite:///./data/jarvis.db` | Async SQLAlchemy DSN |
| `DATABASE_ECHO` | `false` | Log all SQL statements |
| `CORS_ORIGINS` | `["http://localhost:5173", "http://localhost:4173"]` | JSON list of allowed CORS origins |
| `LOG_LEVEL` | `INFO` | Root log level |
| `LOG_FORMAT` | `json` | Log output format (`json` or plain) |
| `AI_PROVIDER` | `openai` | AI provider name (placeholder — no AI yet) |
| `AI_MODEL` | `gpt-4o-mini` | AI model name (placeholder) |
| `AI_API_KEY` | *(empty)* | AI provider API key (placeholder) |
| `VOICE_ENABLED` | `false` | Voice features toggle (placeholder) |
| `VOICE_STT_ENGINE` | *(empty)* | Speech-to-text engine (placeholder) |
| `VOICE_TTS_ENGINE` | *(empty)* | Text-to-speech engine (placeholder) |

## Run

```bash
uv run uvicorn app.main:app --reload
```

The server starts at `http://127.0.0.1:8000` by default:

- Interactive API docs: <http://127.0.0.1:8000/docs>
- Root landing payload: <http://127.0.0.1:8000/>
- Health checks: <http://127.0.0.1:8000/api/v1/health/live>, `/api/v1/health/ready`

On startup the app creates the async engine, session factory, WebSocket manager
and background scheduler; on shutdown it stops the scheduler and disposes the engine.

## Migrations

```bash
uv run alembic upgrade head
```

Alembic runs against `Settings.database_url` (from `.env`/env). The initial
revision `cbe2c4024f3d` creates all tables. See [`docs/POSTGRESQL.md`](docs/POSTGRESQL.md)
for switching to PostgreSQL.

## Tests

```bash
uv run pytest
```

The suite covers API endpoints, error envelope, middleware, config, models,
repositories, services, scheduler, memory/tools, and the WebSocket protocol.

## Lint

```bash
uv run ruff check .
```

## API Reference

All REST endpoints are served under the `/api/v1` prefix. Paginated list
endpoints accept `limit` (1–200, default 20) and `offset` (default 0) query
params and return a `ListResponse[T]` envelope: `{ "items": [...], "total": n }`.

### Root

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Landing payload with name, version and links to docs/health |

### Health & System

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/health/live` | Liveness probe — `{"status": "ok"}` while the process is up |
| `GET` | `/api/v1/health/ready` | Readiness probe — verifies the database is reachable |
| `GET` | `/api/v1/system/info` | Runtime metadata: name, version, environment, python, platform |

### Chat

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/chat/messages` | Persist a user message turn and return a mock assistant reply |

Request body: `{ "message": str, "conversation_id": str \| null }`. A new
conversation is created when `conversation_id` is omitted; unknown IDs return 404.

### Memory

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/memory/entries` | List memory entries (paged) |
| `POST` | `/api/v1/memory/entries` | Create a memory entry (`201`) |
| `GET` | `/api/v1/memory/entries/{entry_id}` | Fetch a single entry |
| `PATCH` | `/api/v1/memory/entries/{entry_id}` | Update a memory entry (re-embeds when content changes) |
| `DELETE` | `/api/v1/memory/entries/{entry_id}` | Delete a memory entry (`204`) |

### Notifications

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/notifications` | List notifications (paged) |
| `POST` | `/api/v1/notifications` | Create a notification (`201`) |
| `PATCH` | `/api/v1/notifications/{notification_id}/read` | Mark read/unread via `?read=true\|false` query param |
| `DELETE` | `/api/v1/notifications/{notification_id}` | Delete a notification (`204`) |

### Reminders

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/reminders` | List reminders (paged) |
| `POST` | `/api/v1/reminders` | Create a reminder (`201`) |
| `PATCH` | `/api/v1/reminders/{reminder_id}` | Update a reminder |
| `DELETE` | `/api/v1/reminders/{reminder_id}` | Delete a reminder (`204`) |

### Settings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/settings` | Return the persisted application settings |
| `PATCH` | `/api/v1/settings` | Merge a partial update into persisted settings |

### Projects

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/projects` | List projects (paged) |
| `POST` | `/api/v1/projects` | Create a project (`201`) |
| `GET` | `/api/v1/projects/{project_id}` | Fetch a single project |
| `PATCH` | `/api/v1/projects/{project_id}` | Update a project |
| `DELETE` | `/api/v1/projects/{project_id}` | Delete a project (`204`) |

## WebSocket Protocol

Connect to `ws://127.0.0.1:8000/ws`.

On connect the server sends a welcome envelope:

```json
{ "type": "hello", "payload": { "active": 1 } }
```

Every server→client message uses the envelope shape
`{ "type": "<type>", "payload": { ... } }`. To keep a connection alive, send a
ping and the server replies with a pong echoing the client timestamp:

```json
{ "type": "ping", "ts": 1700000000000 }   →   { "type": "pong", "payload": { "ts": 1700000000000 } }
```

Supported message types are defined in `app/websocket/protocol.py`
(`hello`, `ping`, `pong`, `heartbeat`, `broadcast`, `error`, `system`).

## Verification Checklist

```bash
cd backend
uv run pytest -q        # all tests pass
uv run ruff check .     # clean
uv run alembic upgrade head   # migrations apply
uv run uvicorn app.main:app --reload   # server boots; GET /api/v1/health/live → 200
```

## Further Reading

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — layering, request lifecycle, WS and scheduler flows
- [`docs/POSTGRESQL.md`](docs/POSTGRESQL.md) — switching from SQLite to PostgreSQL
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — planned features (AI chat, vector memory, auth, etc.)
