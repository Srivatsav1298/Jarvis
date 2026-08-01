# IronmanJARVIS Backend — Design Spec

- **Date**: 2026-08-01
- **Status**: Approved
- **Owner**: Sir (solo user, personal assistant — not SaaS, not multi-user)
- **Frontend**: Existing React + TypeScript frontend (STARC). **Not modified by this work.**

## 1. Purpose

Build the production-grade backend foundation for the personal AI assistant
**IronmanJARVIS**. It powers the existing React frontend with versioned REST
APIs, WebSocket infrastructure, persistent storage, structured logging,
background scheduling, and a clean, testable architecture.

No AI logic is implemented yet — chat, memory, and notifications return
deterministic mock responses behind real service interfaces.

## 2. Constraints & Principles

- Single user. No auth/multi-tenancy.
- **Simplicity > enterprise complexity.** No microservices, no message broker.
- **Clean Architecture**: `api → services → repositories → models` with
  dependencies pointing inward.
- **SOLID**: interfaces for services/repositories, DI throughout, single
  responsibility per module.
- SQLite today, **PostgreSQL-ready** (async SQLAlchemy 2.0, portable types).
- Every file carries a comment explaining its purpose.

## 3. Location & Tooling

- **Path**: `/Users/vatsavabbu/Projects/Jarvis/backend/` (monorepo subdirectory).
- **Runtime**: Python 3.13 (3.12 compatible) via `uv` (uv.lock for reproducibility).
- **Stack**: FastAPI, Uvicorn, Pydantic v2, SQLAlchemy 2 (async), Alembic, SQLite
  (`aiosqlite`), pytest, ruff.

## 4. Package Layout

```
backend/
  pyproject.toml, uv.lock, .env.example, .env, .gitignore
  alembic.ini
  alembic/                    # async migration environment
  app/
    main.py                   # app factory + lifespan
    api/v1/                   # routers: health, system, chat, memory, notifications, settings, projects, reminders
    config/                   # pydantic-settings Settings (.env)
    core/                     # constants, app metadata, security (placeholders)
    database/                 # async engine, session factory, Base
    models/                   # SQLAlchemy 2.0 mapped classes
    schemas/                  # Pydantic v2 request/response models
    repositories/             # generic base + concrete repos
    services/                 # business logic (mock AI, memory, settings, notifications, reminders, projects)
    tools/                    # future tool registry (thin placeholder)
    memory/                   # memory manager (SQLite-backed, vector-ready)
    websocket/                # ConnectionManager (connect/disconnect/broadcast/heartbeat)
    scheduler/                # asyncio periodic-task runner
    middleware/               # request logging/timing, CORS
    dependencies/             # DI: db session, settings
    exceptions/               # typed exception hierarchy + handlers
    utils/                    # structured JSON logging, time, ids
  tests/                      # pytest + pytest-asyncio + httpx ASGI client
```

## 5. Key Technical Decisions

| Concern | Decision |
|---|---|
| DB access | SQLAlchemy 2.0 **async**; `aiosqlite` now, `asyncpg` for Postgres later (DSN-only change) |
| Migrations | Alembic, async engine in `env.py` |
| Config | `pydantic-settings`; one `Settings` class; DI everywhere; never raw `os.environ` |
| Logging | JSON-lines formatter on stdlib `logging`; request latency, startup/shutdown, errors |
| Scheduler | Minimal asyncio periodic-task runner; graceful shutdown; no heavy framework |
| WebSocket | `/ws` ConnectionManager; typed envelope; heartbeat ping/pong; broadcast; streaming hooks reserved |
| Errors | `JARVISError` hierarchy → uniform JSON error body (RFC-7807-style) |
| API versioning | `/api/v1` prefix throughout |
| IDs/timestamps | UUID PKs, UTC `datetime`, server defaults, portable column types |
| Quality | ruff lint+format, full type hints, pytest (unit + API + WS) |

## 6. Domain Model

`Conversation`, `Message`, `Project`, `Preference`, `Notification`, `Reminder`,
`MemoryEntry`, `Settings`. All SQLite-first, Postgres-portable.

- Conversation 1—N Message
- Settings singleton (key/value)
- Preference (key/value scoped rows)
- Reminder references a due timestamp + optional Conversation link
- Notification has type/severity/read flags
- MemoryEntry has content, kind, importance, embedding-ready nullable column

## 7. API Surface (`/api/v1`)

- `GET /health/live`, `GET /health/ready`
- `GET /system/info` — runtime metadata
- `POST /chat/messages` — mock AI reply (echo/static, streaming-ready)
- `GET|POST|DELETE /memory/entries` — placeholder CRUD via MemoryService
- `GET|PATCH|POST|DELETE /notifications`
- `GET|PATCH /settings`
- `GET|POST|PATCH|DELETE /projects`
- `GET|POST|PATCH|DELETE /reminders`

All responses typed with Pydantic v2 schemas; validation errors and app errors
return the uniform error envelope.

## 8. WebSocket Protocol

Endpoint `/ws`. Envelope `{"type": "..."}`. Types now: `hello`, `pong`,
`heartbeat`, `broadcast`, `system`. ConnectionManager handles connect,
disconnect, per-client send, broadcast, heartbeat ping/pong. Reserved:
`stream.token`, `stream.end` for future AI streaming.

## 9. Testing

- `tests/unit/` — config, utils, scheduler, repositories (in-memory SQLite)
- `tests/api/` — health, system, chat, memory, settings, error envelope
- `tests/websocket/` — connect, heartbeat, broadcast round-trip
- Tooling: `pytest`, `pytest-asyncio`, `httpx` ASGI transport

## 10. Verification (definition of done)

1. `uv sync`
2. `alembic upgrade head` against SQLite succeeds
3. `pytest` all green
4. `uvicorn app.main:app` boots
5. `GET /api/v1/health/live` → 200
6. Mock chat call → 200 typed response
7. WebSocket connect + heartbeat + broadcast round-trip verified
8. Clean shutdown (scheduler/DB disposed)

## 11. Docs to Deliver

- `README.md` — overview, how to run, env vars, tests
- `docs/ARCHITECTURE.md` — layer responsibilities + Mermaid dependency graph
- `docs/POSTGRESQL.md` — migration path
- `docs/ROADMAP.md` — future expansion notes
