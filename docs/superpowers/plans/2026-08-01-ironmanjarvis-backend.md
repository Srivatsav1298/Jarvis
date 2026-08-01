# IronmanJARVIS Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the production-grade, clean-architecture FastAPI backend foundation for IronmanJARVIS inside `/Users/vatsavabbu/Projects/Jarvis/backend/`, wired to the existing React frontend.

**Architecture:** Async FastAPI app with strict layering `api → services → repositories → models`. DI via FastAPI dependencies; SQLAlchemy 2.0 async + SQLite (`aiosqlite`) now, Postgres (`asyncpg`) later by DSN change. Structured JSON logging, asyncio scheduler, WebSocket ConnectionManager with heartbeat.

**Tech Stack:** Python 3.13 (≥3.12), FastAPI, Uvicorn, Pydantic v2 (`pydantic-settings`), SQLAlchemy 2.0 async, Alembic, aiosqlite, pytest, pytest-asyncio, httpx, asgi-lifespan, ruff. Package manager: `uv`.

## Global Constraints

- All backend code lives under `/Users/vatsavabbu/Projects/Jarvis/backend/`; do not touch `src/`, `package.json`, or any frontend file.
- Python ≥3.12; use `uv` for env/deps (`uv sync`, `uv run …`).
- Every file MUST contain a comment explaining its purpose (docstring or header comment).
- SOLID + Clean Architecture: dependencies point inward (`api` → `services` → `repositories` → `models`); no layer imports upward.
- No AI logic. Chat/memory/notifications return deterministic mocks behind real service interfaces.
- No direct `os.environ` reads in application code — config flows through `app/config/settings.py` via DI.
- SQLite-only constructs are forbidden in `models/`; all types must be Postgres-portable (UUID as `String(36)`, JSON, DateTime(UTC)).
- Files stay small and single-purpose (<500 lines each).
- Every task ends with an independently testable deliverable and a commit.

---

### Task 1: Scaffold, config, core, utils, logging, exceptions

**Files:**
- Create: `backend/pyproject.toml`, `backend/.env.example`, `backend/.env`, `backend/.gitignore`
- Create: `backend/app/__init__.py`, `backend/app/config/__init__.py`, `backend/app/config/settings.py`
- Create: `backend/app/core/__init__.py`, `backend/app/core/constants.py`
- Create: `backend/app/utils/__init__.py`, `backend/app/utils/time.py`, `backend/app/utils/ids.py`, `backend/app/utils/logging.py`
- Create: `backend/app/exceptions/__init__.py`, `backend/app/exceptions/base.py`, `backend/app/exceptions/api_errors.py`
- Test: `backend/tests/__init__.py`, `backend/tests/unit/test_config.py`, `backend/tests/unit/test_logging.py`

**Interfaces:**
- Produces: `Settings` (pydantic-settings) with fields `app_name, app_version, environment, debug, host, port, api_prefix, database_url, database_echo, cors_origins, log_level, log_format, ai_provider, ai_model, ai_api_key, voice_enabled, voice_stt_engine, voice_tts_engine`, property `is_production`; `get_settings()` cached factory.
- Produces: `AppEnvironment` StrEnum; `HEARTBEAT_INTERVAL_SECONDS`, `REMINDER_SWEEP_INTERVAL_SECONDS`, `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE`.
- Produces: `utcnow()` → tz-aware UTC `datetime`; `to_iso(dt)` → str|None; `new_id()` → str UUID4.
- Produces: `configure_logging(level, fmt)`; `get_logger(name)`; `JsonFormatter`.
- Produces: `JARVISError(status_code, code, message, detail)` base; `NotFoundError`, `ConflictError`, `ValidationAppError`, `UnauthorizedError`, `ForbiddenError`, `ServiceUnavailableError`.

- [ ] **Step 1: Create `pyproject.toml`**

```toml
[project]
name = "ironman-jarvis-backend"
version = "0.1.0"
description = "Production-grade backend foundation for the IronmanJARVIS personal AI assistant"
readme = "README.md"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.115,<1.0",
  "uvicorn[standard]>=0.30,<1.0",
  "pydantic>=2.8,<3.0",
  "pydantic-settings>=2.4,<3.0",
  "sqlalchemy[asyncio]>=2.0.30,<3.0",
  "aiosqlite>=0.20,<1.0",
  "alembic>=1.13,<2.0",
]

[dependency-groups]
dev = [
  "pytest>=8.2,<9.0",
  "pytest-asyncio>=0.23,<1.0",
  "httpx>=0.27,<1.0",
  "asgi-lifespan>=2.1,<3.0",
  "ruff>=0.6,<1.0",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM"]
```

- [ ] **Step 2: Create `.env.example`, `.env`, `.gitignore`**

`.env.example`:
```dotenv
# Application
APP_ENV=development
APP_DEBUG=true
APP_NAME=IronmanJARVIS
APP_VERSION=0.1.0
APP_HOST=127.0.0.1
APP_PORT=8000
API_PREFIX=/api/v1

# Database (SQLite now; swap to postgresql+asyncpg://... later)
DATABASE_URL=sqlite+aiosqlite:///./data/jarvis.db
DATABASE_ECHO=false

# CORS (JSON list)
CORS_ORIGINS=["http://localhost:5173","http://localhost:4173"]

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json

# AI provider (placeholders — no AI logic yet)
AI_PROVIDER=openai
AI_MODEL=gpt-4o-mini
AI_API_KEY=

# Voice (placeholders for future STT/TTS)
VOICE_ENABLED=false
VOICE_STT_ENGINE=
VOICE_TTS_ENGINE=
```

`.env`: copy `.env.example` (development defaults).

`.gitignore`:
```gitignore
# Python
__pycache__/
*.py[cod]
.venv/
*.egg-info/

# Env & secrets
.env

# Data
data/
*.db
*.sqlite3

# Tooling
.pytest_cache/
.ruff_cache/
.mypy_cache/
```

- [ ] **Step 3: Create config**

`backend/app/__init__.py`:
```python
"""IronmanJARVIS backend package."""
```

`backend/app/config/__init__.py`:
```python
"""Configuration subsystem: environment-driven settings and accessors."""
```

`backend/app/config/settings.py`:
```python
"""Application configuration loaded from environment variables and .env."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Single source of truth for runtime configuration (env + .env)."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "IronmanJARVIS"
    app_version: str = "0.1.0"
    environment: str = "development"
    debug: bool = False
    host: str = "127.0.0.1"
    port: int = 8000
    api_prefix: str = "/api/v1"

    # Database
    database_url: str = "sqlite+aiosqlite:///./data/jarvis.db"
    database_echo: bool = False

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:4173"]

    # Logging
    log_level: str = "INFO"
    log_format: str = "json"

    # AI provider (placeholders — no AI logic yet)
    ai_provider: str = "openai"
    ai_model: str = "gpt-4o-mini"
    ai_api_key: str = ""

    # Voice (placeholders for future STT/TTS)
    voice_enabled: bool = False
    voice_stt_engine: str = ""
    voice_tts_engine: str = ""

    @property
    def is_production(self) -> bool:
        """True when running in the production environment."""
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    """Return the cached application settings instance."""
    return Settings()
```

- [ ] **Step 4: Create core + utils**

`backend/app/core/__init__.py`:
```python
"""Core cross-cutting constants and metadata."""
```

`backend/app/core/constants.py`:
```python
"""Central constants shared across the application."""
from enum import StrEnum


class AppEnvironment(StrEnum):
    """Valid runtime environments."""

    DEVELOPMENT = "development"
    PRODUCTION = "production"
    TESTING = "testing"


HEARTBEAT_INTERVAL_SECONDS = 30.0
REMINDER_SWEEP_INTERVAL_SECONDS = 60.0
DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 200
```

`backend/app/utils/__init__.py`:
```python
"""Cross-cutting helpers (time, ids, logging)."""
```

`backend/app/utils/time.py`:
```python
"""UTC datetime helpers shared across the application."""
from datetime import UTC, datetime


def utcnow() -> datetime:
    """Return the current time as a timezone-aware UTC datetime."""
    return datetime.now(UTC)


def to_iso(value: datetime | None) -> str | None:
    """Serialize a datetime to an ISO-8601 string, or None."""
    return value.isoformat() if value else None
```

`backend/app/utils/ids.py`:
```python
"""Identifier helpers."""
import uuid


def new_id() -> str:
    """Return a fresh random UUID4 string suitable for a primary key."""
    return str(uuid.uuid4())
```

`backend/app/utils/logging.py`:
```python
"""Structured JSON-lines logging configuration for the whole application."""
import json
import logging
import sys
from datetime import UTC, datetime
from typing import Any


class JsonFormatter(logging.Formatter):
    """Format each log record as a single-line JSON object."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        extra = getattr(record, "extra_fields", None)
        if isinstance(extra, dict):
            payload.update(extra)
        return json.dumps(payload, default=str)


def configure_logging(level: str = "INFO", fmt: str = "json") -> None:
    """Configure the root logger with a single stdout handler."""
    root = logging.getLogger()
    root.setLevel(level.upper())
    handler = logging.StreamHandler(sys.stdout)
    if fmt == "json":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
        )
    root.handlers = [handler]
    root.propagate = False


def get_logger(name: str) -> logging.Logger:
    """Return a named child logger for structured logging."""
    return logging.getLogger(name)
```

- [ ] **Step 5: Create exceptions**

`backend/app/exceptions/__init__.py`:
```python
"""Typed exception hierarchy and their HTTP handlers."""
from app.exceptions.api_errors import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ServiceUnavailableError,
    UnauthorizedError,
    ValidationAppError,
)
from app.exceptions.base import JARVISError

__all__ = [
    "JARVISError",
    "NotFoundError",
    "ConflictError",
    "ValidationAppError",
    "UnauthorizedError",
    "ForbiddenError",
    "ServiceUnavailableError",
]
```

`backend/app/exceptions/base.py`:
```python
"""Base class for every application-specific domain error."""
from typing import Any


class JARVISError(Exception):
    """Base exception; subclasses carry an HTTP status and machine code."""

    status_code = 500
    code = "internal_error"

    def __init__(self, message: str = "An unexpected error occurred.", *, detail: Any = None) -> None:
        super().__init__(message)
        self.message = message
        self.detail = detail
```

`backend/app/exceptions/api_errors.py`:
```python
"""Concrete HTTP error types used by services and endpoints."""
from app.exceptions.base import JARVISError


class NotFoundError(JARVISError):
    """Raised when a requested resource does not exist (404)."""

    status_code = 404
    code = "not_found"


class ConflictError(JARVISError):
    """Raised when a change conflicts with existing state (409)."""

    status_code = 409
    code = "conflict"


class ValidationAppError(JARVISError):
    """Raised for business-rule validation failures (422)."""

    status_code = 422
    code = "validation_error"


class UnauthorizedError(JARVISError):
    """Raised when credentials are missing/invalid (401)."""

    status_code = 401
    code = "unauthorized"


class ForbiddenError(JARVISError):
    """Raised when the caller lacks permission (403)."""

    status_code = 403
    code = "forbidden"


class ServiceUnavailableError(JARVISError):
    """Raised when a dependency is unreachable (503)."""

    status_code = 503
    code = "service_unavailable"
```

- [ ] **Step 6: Write failing tests**

`backend/tests/__init__.py`:
```python
"""Test suite for the IronmanJARVIS backend."""
```

`backend/tests/unit/test_config.py`:
```python
"""Tests for application settings loading and defaults."""
from app.config.settings import Settings


def test_defaults_are_sane() -> None:
    settings = Settings(_env_file=None)
    assert settings.app_name == "IronmanJARVIS"
    assert settings.environment == "development"
    assert settings.database_url.startswith("sqlite+aiosqlite")
    assert not settings.is_production


def test_env_overrides_defaults(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("AI_MODEL", "gpt-5")
    settings = Settings(_env_file=None)
    assert settings.environment == "production"
    assert settings.ai_model == "gpt-5"
    assert settings.is_production
```

`backend/tests/unit/test_logging.py`:
```python
"""Tests for the structured JSON logger."""
import json
import logging

from app.utils.logging import JsonFormatter, configure_logging


def test_json_formatter_emits_parseable_line() -> None:
    record = logging.LogRecord("test", logging.INFO, __file__, 1, "hello", None, None)
    record.extra_fields = {"method": "GET"}  # type: ignore[attr-defined]
    line = JsonFormatter().format(record)
    payload = json.loads(line)
    assert payload["level"] == "INFO"
    assert payload["message"] == "hello"
    assert payload["method"] == "GET"


def test_configure_logging_sets_level() -> None:
    configure_logging("WARNING", "json")
    assert logging.getLogger().level == logging.WARNING
```

- [ ] **Step 7: Run tests — expect 2 failures (no `app` package yet)**

Run: `cd backend && uv sync && uv run pytest tests/unit -q`
Expected: collection error / import failures.

- [ ] **Step 8: Install deps + run tests to green**

Run: `cd backend && uv sync`
Run: `uv run pytest -q`
Expected: 4 passed (config 2, logging 2). Then `uv run ruff check .` → 0 errors.

- [ ] **Step 9: Commit**

```bash
cd backend
git add -A
git commit -m "feat(backend): scaffold, config, core, utils, logging, exceptions"
```

---

### Task 2: Database foundation + ORM models + schemas

**Files:**
- Create: `backend/app/database/__init__.py`, `backend/app/database/base.py`, `backend/app/database/engine.py`, `backend/app/database/session.py`
- Create: `backend/app/models/__init__.py` + 8 model files: `conversation.py`, `message.py`, `project.py`, `preference.py`, `notification.py`, `reminder.py`, `memory_entry.py`, `settings_record.py`
- Create: `backend/app/schemas/__init__.py`, `backend/app/schemas/common.py`, `chat.py`, `memory.py`, `notification.py`, `reminder.py`, `settings.py`, `project.py`
- Test: `backend/tests/unit/test_models.py`

**Interfaces:**
- Produces: `Base` (DeclarativeBase) + `TimestampMixin` (`created_at`, `updated_at`).
- Produces: `build_engine(settings) -> AsyncEngine` (registers SQLite FK pragma); `dispose_engine(engine)`; `build_session_factory(engine) -> async_sessionmaker[AsyncSession]`.
- Produces models: `Conversation`, `Message`, `Project`, `Preference`, `Notification`, `Reminder`, `MemoryEntry`, `SettingsRecord` — all with `String(36)` UUID PK (`default=new_id`), `TimestampMixin`.
- Produces schemas: `APIModel` (from_attributes), `ErrorBody`, `ListResponse[T]`; `ChatMessageRequest/ChatResponse`; `MemoryEntryCreate/Update/Read`; `NotificationCreate/Update/Read`; `ReminderCreate/Update/Read`; `SettingsRead/SettingsUpdate`; `ProjectCreate/Update/Read`.

- [ ] **Step 1: Create `database/`**

`backend/app/database/__init__.py`:
```python
"""Async database infrastructure: engine, session factory, declarative base."""
```

`backend/app/database/base.py`:
```python
"""Declarative base and shared mixins for every ORM model."""
from datetime import datetime

from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.utils.time import utcnow


class Base(DeclarativeBase):
    """Abstract declarative base class for all models."""


class TimestampMixin:
    """Adds UTC created_at/updated_at columns with sensible defaults."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
```

`backend/app/database/engine.py`:
```python
"""Async SQLAlchemy engine factory and lifecycle helpers."""
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.config.settings import Settings


def build_engine(settings: Settings) -> AsyncEngine:
    """Create an async engine from application settings."""
    engine = create_async_engine(settings.database_url, echo=settings.database_echo, future=True)
    if settings.database_url.startswith("sqlite"):
        event.listen(engine.sync_engine, "connect", _enable_sqlite_fk)
    return engine


def _enable_sqlite_fk(dbapi_connection, _connection_record) -> None:
    """Turn on SQLite foreign-key enforcement per connection."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


async def dispose_engine(engine: AsyncEngine) -> None:
    """Gracefully dispose the engine, releasing pooled connections."""
    await engine.dispose()
```

`backend/app/database/session.py`:
```python
"""Async session factory creation."""
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
)


def build_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """Return a sessionmaker bound to the given engine."""
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
```

- [ ] **Step 2: Create models**

`backend/app/models/__init__.py`:
```python
"""ORM models. Importing this module registers all tables on Base.metadata."""
from app.models.conversation import Conversation
from app.models.memory_entry import MemoryEntry
from app.models.message import Message
from app.models.notification import Notification
from app.models.preference import Preference
from app.models.project import Project
from app.models.reminder import Reminder
from app.models.settings_record import SettingsRecord

__all__ = [
    "Conversation",
    "Message",
    "Project",
    "Preference",
    "Notification",
    "Reminder",
    "MemoryEntry",
    "SettingsRecord",
]
```

`backend/app/models/conversation.py`:
```python
"""Conversation ORM model — a persisted chat thread."""
from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin
from app.utils.ids import new_id

if TYPE_CHECKING:
    from app.models.message import Message


class Conversation(TimestampMixin, Base):
    """A single chat conversation containing many messages."""

    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(String(255), default="New conversation")

    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )
```

`backend/app/models/message.py`:
```python
"""Message ORM model — one turn in a conversation."""
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin
from app.utils.ids import new_id

if TYPE_CHECKING:
    from app.models.conversation import Conversation


class Message(TimestampMixin, Base):
    """A single message (user or assistant) inside a conversation."""

    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(32))
    content: Mapped[str] = mapped_column(Text)
    tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")
```

`backend/app/models/project.py`:
```python
"""Project ORM model — a tracked work item or initiative."""
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin
from app.utils.ids import new_id


class Project(TimestampMixin, Base):
    """A project the assistant tracks for its owner."""

    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active")
    color: Mapped[str] = mapped_column(String(16), default="accent")
```

`backend/app/models/preference.py`:
```python
"""Preference ORM model — a key/value user preference row."""
from sqlalchemy import String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin
from app.utils.ids import new_id


class Preference(TimestampMixin, Base):
    """A single user preference identified by a unique key."""

    __tablename__ = "preferences"
    __table_args__ = (UniqueConstraint("key", name="uq_preferences_key"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    key: Mapped[str] = mapped_column(String(100), index=True)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
```

`backend/app/models/notification.py`:
```python
"""Notification ORM model — an alert surfaced in the UI."""
from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin
from app.utils.ids import new_id


class Notification(TimestampMixin, Base):
    """A system or assistant notification."""

    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    type: Mapped[str] = mapped_column(String(64), default="info")
    severity: Mapped[str] = mapped_column(String(16), default="info")
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
```

`backend/app/models/reminder.py`:
```python
"""Reminder ORM model — a future-dated task or notification."""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin
from app.utils.ids import new_id


class Reminder(TimestampMixin, Base):
    """A reminder that becomes due at `due_at`."""

    __tablename__ = "reminders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(String(200))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    conversation_id: Mapped[str | None] = mapped_column(
        ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True
    )
```

`backend/app/models/memory_entry.py`:
```python
"""MemoryEntry ORM model — a persisted assistant memory with embedding hook."""
from typing import Any

from sqlalchemy import JSON, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin
from app.utils.ids import new_id


class MemoryEntry(TimestampMixin, Base):
    """A single memory the assistant persists for its owner."""

    __tablename__ = "memory_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    kind: Mapped[str] = mapped_column(String(64), default="note")
    content: Mapped[str] = mapped_column(Text)
    importance: Mapped[float] = mapped_column(Float, default=0.5)
    data: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    embedding: Mapped[list[float] | None] = mapped_column(JSON, nullable=True)
```

`backend/app/models/settings_record.py`:
```python
"""SettingsRecord ORM model — a singleton row holding app settings as JSON."""
from typing import Any

from sqlalchemy import JSON, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin


class SettingsRecord(TimestampMixin, Base):
    """Singleton application-settings row (one row, id=1)."""

    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
```

- [ ] **Step 3: Create schemas**

`backend/app/schemas/__init__.py`:
```python
"""Pydantic v2 request/response schemas for the API."""
```

`backend/app/schemas/common.py`:
```python
"""Shared Pydantic models: base schema, error body, generic list response."""
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class APIModel(BaseModel):
    """Base schema; reads attributes from ORM objects."""

    model_config = ConfigDict(from_attributes=True)


class ErrorBody(BaseModel):
    """Uniform error envelope returned by exception handlers."""

    type: str
    title: str
    status: int
    code: str
    detail: object | None = None


class ListResponse(BaseModel, Generic[T]):
    """Generic paginated payload: items plus total count."""

    items: list[T]
    total: int
```

`backend/app/schemas/chat.py`:
```python
"""Chat request/response schemas (mock stage)."""
from datetime import datetime

from app.schemas.common import APIModel


class ChatMessageRequest(APIModel):
    """Incoming user message to the chat endpoint."""

    message: str
    conversation_id: str | None = None


class ChatResponse(APIModel):
    """Mock chat reply plus provenance metadata."""

    reply: str
    conversation_id: str
    model: str
    latency_ms: int
    created_at: datetime
```

`backend/app/schemas/memory.py`:
```python
"""Memory entry schemas."""
from datetime import datetime

from pydantic import Field

from app.schemas.common import APIModel


class MemoryEntryCreate(APIModel):
    """Payload for creating a memory entry."""

    kind: str = "note"
    content: str = Field(min_length=1, max_length=4000)
    importance: float = Field(default=0.5, ge=0, le=1)


class MemoryEntryUpdate(APIModel):
    """Optional fields for updating a memory entry."""

    kind: str | None = None
    content: str | None = Field(default=None, min_length=1, max_length=4000)
    importance: float | None = Field(default=None, ge=0, le=1)


class MemoryEntryRead(APIModel):
    """Memory entry as returned by the API."""

    id: str
    kind: str
    content: str
    importance: float
    created_at: datetime
    updated_at: datetime
```

`backend/app/schemas/notification.py`:
```python
"""Notification schemas."""
from datetime import datetime

from pydantic import Field

from app.schemas.common import APIModel


class NotificationCreate(APIModel):
    """Payload for creating a notification."""

    type: str = "info"
    severity: str = Field(default="info", pattern="^(info|ok|warn|danger|accent)$")
    title: str = Field(min_length=1, max_length=200)
    message: str | None = None


class NotificationUpdate(APIModel):
    """Optional fields for updating a notification."""

    read: bool | None = None
    severity: str | None = Field(default=None, pattern="^(info|ok|warn|danger|accent)$")
    title: str | None = Field(default=None, min_length=1, max_length=200)
    message: str | None = None


class NotificationRead(APIModel):
    """Notification as returned by the API."""

    id: str
    type: str
    severity: str
    title: str
    message: str | None
    read: bool
    created_at: datetime
```

`backend/app/schemas/reminder.py`:
```python
"""Reminder schemas."""
from datetime import datetime

from pydantic import Field

from app.schemas.common import APIModel


class ReminderCreate(APIModel):
    """Payload for creating a reminder."""

    title: str = Field(min_length=1, max_length=200)
    note: str | None = None
    due_at: datetime | None = None
    conversation_id: str | None = None


class ReminderUpdate(APIModel):
    """Optional fields for updating a reminder."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    note: str | None = None
    due_at: datetime | None = None
    completed: bool | None = None


class ReminderRead(APIModel):
    """Reminder as returned by the API."""

    id: str
    title: str
    note: str | None
    due_at: datetime | None
    completed: bool
    conversation_id: str | None
    created_at: datetime
```

`backend/app/schemas/settings.py`:
```python
"""Application settings schemas."""
from typing import Any

from app.schemas.common import APIModel


class SettingsRead(APIModel):
    """Current persisted application settings."""

    data: dict[str, Any]


class SettingsUpdate(APIModel):
    """Partial update payload for persisted settings."""

    data: dict[str, Any]
```

`backend/app/schemas/project.py`:
```python
"""Project schemas."""
from datetime import datetime

from pydantic import Field

from app.schemas.common import APIModel


class ProjectCreate(APIModel):
    """Payload for creating a project."""

    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    status: str = Field(default="active", pattern="^(active|paused|archived)$")
    color: str = Field(default="accent", max_length=16)


class ProjectUpdate(APIModel):
    """Optional fields for updating a project."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    status: str | None = Field(default=None, pattern="^(active|paused|archived)$")
    color: str | None = Field(default=None, max_length=16)


class ProjectRead(APIModel):
    """Project as returned by the API."""

    id: str
    name: str
    description: str | None
    status: str
    color: str
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 4: Write failing tests**

`backend/tests/unit/test_models.py`:
```python
"""Tests for ORM model creation and round-tripping."""
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database.base import Base
from app.models import Conversation, MemoryEntry, Message, SettingsRecord


@pytest.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


async def test_conversation_with_messages_roundtrip(session) -> None:
    conversation = Conversation(title="Greetings")
    session.add(conversation)
    await session.flush()
    session.add_all(
        [
            Message(conversation_id=conversation.id, role="user", content="Hello"),
            Message(conversation_id=conversation.id, role="assistant", content="Hi!"),
        ]
    )
    await session.commit()
    await session.refresh(conversation)
    assert len(conversation.messages) == 2
    assert all(m.created_at is not None for m in conversation.messages)


async def test_memory_entry_and_settings_roundtrip(session) -> None:
    session.add(
        MemoryEntry(kind="fact", content="Sir prefers dark mode", importance=0.9)
    )
    session.add(SettingsRecord(data={"theme": "dark"}))
    await session.commit()
    result = await session.execute(
        "SELECT count(*) FROM memory_entries"
    )
    assert result.scalar_one() == 1
    result = await session.execute("SELECT count(*) FROM settings")
    assert result.scalar_one() == 1
```

- [ ] **Step 5: Run tests — expect model tests to fail until models exist**

Run: `cd backend && uv run pytest tests/unit/test_models.py -q`
Expected: collection/import error, then green after implementation.

- [ ] **Step 6: Verify green + ruff**

Run: `cd backend && uv run pytest -q` → all pass (config 2, logging 2, models 2).
Run: `uv run ruff check .` → 0 errors.

- [ ] **Step 7: Commit**

```bash
cd backend
git add -A
git commit -m "feat(backend): async database foundation, ORM models, pydantic schemas"
```

---

### Task 3: Alembic async migrations

**Files:**
- Create: `backend/alembic.ini`, `backend/alembic/` (generated by `alembic init`), overwrite `backend/alembic/env.py`
- Create: `backend/data/.gitkeep`
- Verify: `backend/alembic/versions/0001_initial.py` (autogenerated)

**Interfaces:**
- Consumes: `get_settings()` from Task 1; `Base.metadata` from Task 2.
- Produces: migration environment that works with the async engine; `alembic upgrade head` creates the SQLite schema.

- [ ] **Step 1: Run alembic init**

Run: `cd backend && uv run alembic init alembic`
Expected: creates `alembic.ini`, `alembic/env.py`, `alembic/script.py.mako`, `alembic/versions/`.

- [ ] **Step 2: Configure `alembic.ini`**

Edit `alembic.ini`: set `script_location = alembic`, `prepend_sys_path = .`, `sqlalchemy.url =` (left empty — env.py supplies it). Ensure section has:
```ini
[alembic]
script_location = alembic
prepend_sys_path = .
sqlalchemy.url =
```

- [ ] **Step 3: Overwrite `alembic/env.py` (async)**

Write `backend/alembic/env.py`:
```python
"""Alembic environment: async engine support, settings-driven DSN."""
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

import app.models  # noqa: F401 — registers all models on Base.metadata
from app.config.settings import get_settings
from app.database.base import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    """Return the database URL from application settings."""
    return get_settings().database_url


def run_migrations_offline() -> None:
    """Run migrations without a live database connection."""
    context.configure(
        url=get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    """Configure context against a live connection and migrate."""
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create an async engine and run migrations against it."""
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = get_url()
    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    """Entry point for online migrations (async engine)."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 4: Create `data/` dir + initial migration**

Run: `cd backend && mkdir -p data && touch data/.gitkeep`
Run: `uv run alembic revision --autogenerate -m "initial schema"`
Expected: creates `alembic/versions/xxxx_initial_schema.py` with all 8 tables.

- [ ] **Step 5: Apply the migration**

Run: `uv run alembic upgrade head`
Expected: logs "Running upgrade ... -> ..., initial schema"; SQLite file `data/jarvis.db` created.

- [ ] **Step 6: Verify tables**

Run: `uv run python -c "import sqlite3; c=sqlite3.connect('data/jarvis.db'); print(sorted(r[0] for r in c.execute(\"SELECT name FROM sqlite_master WHERE type='table'\")))"`
Expected: includes `conversations, messages, projects, preferences, notifications, reminders, memory_entries, settings`.

- [ ] **Step 7: Commit**

```bash
cd backend
git add -A
git commit -m "feat(backend): alembic async migrations with initial schema"
```

---

### Task 4: Repositories + services

**Files:**
- Create: `backend/app/repositories/__init__.py`, `backend/app/repositories/base.py`, `backend/app/repositories/implementations.py`
- Create: `backend/app/services/__init__.py`, `backend/app/services/base.py`, `backend/app/services/chat.py`, `backend/app/services/notifications.py`, `backend/app/services/reminders.py`, `backend/app/services/settings.py`, `backend/app/services/projects.py`, `backend/app/services/system.py`
- Create: `backend/app/memory/__init__.py`, `backend/app/memory/manager.py`
- Create: `backend/app/tools/__init__.py`, `backend/app/tools/registry.py`
- Test: `backend/tests/unit/test_repositories.py`, `backend/tests/unit/test_services.py`, `backend/tests/unit/test_memory_tools.py`

**Interfaces:**
- Produces: `Repository[T]` ABC (`get/list/count/create/update/delete`); `SQLAlchemyRepository[T]` generic impl; concrete `ConversationRepository`, `MessageRepository`, `ProjectRepository`, `PreferenceRepository`, `NotificationRepository`, `ReminderRepository`, `MemoryRepository`, `SettingsRepository` (with `get_singleton`).
- Produces `app/memory/manager.py`: `MemoryManager(repo)` with `list`, `create`, `update`, `delete`, `get`, `search(query, limit)` (deterministic importance-ranked stub) and private `_embed(content)` placeholder returning `None`.
- Produces `app/tools/registry.py`: `ToolRegistry` with `register(name, description, handler)`, `list()`, `invoke(name, **kwargs)`; built-in `ping` tool returns `{"pong": True}`.
- Produces services:
  - `ChatService(conversations, messages, settings).respond(ChatMessageRequest) -> ChatResponse`
  - `NotificationService(repo).list/create/mark_read/delete`
  - `ReminderService(repo, session).list/create/get/update/delete/count_due`
  - `SettingsService(repo).get_all/merge`
  - `ProjectService(repo).list/create/get/update/delete`
  - `SystemService.info() -> dict`

- [ ] **Step 1: Create repository layer**

`backend/app/repositories/__init__.py`:
```python
"""Repository layer: interfaces + SQLAlchemy implementations."""
```

`backend/app/repositories/base.py`:
```python
"""Generic repository interface and its SQLAlchemy implementation."""
from abc import ABC, abstractmethod
from typing import Any, Generic, Sequence, TypeVar

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.base import Base

T = TypeVar("T", bound=Base)


class Repository(ABC, Generic[T]):
    """Interface for data access for a single aggregate."""

    @abstractmethod
    async def get(self, entity_id: str) -> T | None: ...

    @abstractmethod
    async def list(self, *, limit: int, offset: int) -> Sequence[T]: ...

    @abstractmethod
    async def count(self) -> int: ...

    @abstractmethod
    async def create(self, data: dict[str, Any]) -> T: ...

    @abstractmethod
    async def update(self, entity_id: str, data: dict[str, Any]) -> T | None: ...

    @abstractmethod
    async def delete(self, entity_id: str) -> bool: ...


class SQLAlchemyRepository(Repository[T]):
    """Default repository implementation backed by an async session."""

    model: type[T]

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, entity_id: str) -> T | None:
        return await self.session.get(self.model, entity_id)

    async def list(self, *, limit: int, offset: int) -> Sequence[T]:
        result = await self.session.execute(
            select(self.model)
            .order_by(self.model.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return result.scalars().all()

    async def count(self) -> int:
        result = await self.session.execute(
            select(func.count()).select_from(self.model)
        )
        return int(result.scalar_one())

    async def create(self, data: dict[str, Any]) -> T:
        instance = self.model(**data)
        self.session.add(instance)
        await self.session.commit()
        await self.session.refresh(instance)
        return instance

    async def update(self, entity_id: str, data: dict[str, Any]) -> T | None:
        instance = await self.get(entity_id)
        if instance is None:
            return None
        for key, value in data.items():
            if value is not None:
                setattr(instance, key, value)
        await self.session.commit()
        await self.session.refresh(instance)
        return instance

    async def delete(self, entity_id: str) -> bool:
        instance = await self.get(entity_id)
        if instance is None:
            return False
        await self.session.delete(instance)
        await self.session.commit()
        return True
```

`backend/app/repositories/implementations.py`:
```python
"""Concrete repositories — one small class per aggregate."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Conversation,
    MemoryEntry,
    Message,
    Notification,
    Preference,
    Project,
    Reminder,
    SettingsRecord,
)
from app.repositories.base import SQLAlchemyRepository


class ConversationRepository(SQLAlchemyRepository[Conversation]):
    """Data access for conversations."""

    model = Conversation


class MessageRepository(SQLAlchemyRepository[Message]):
    """Data access for messages."""

    model = Message


class ProjectRepository(SQLAlchemyRepository[Project]):
    """Data access for projects."""

    model = Project


class PreferenceRepository(SQLAlchemyRepository[Preference]):
    """Data access for preferences."""

    model = Preference


class NotificationRepository(SQLAlchemyRepository[Notification]):
    """Data access for notifications."""

    model = Notification


class ReminderRepository(SQLAlchemyRepository[Reminder]):
    """Data access for reminders."""

    model = Reminder


class MemoryRepository(SQLAlchemyRepository[MemoryEntry]):
    """Data access for memory entries."""

    model = MemoryEntry


class SettingsRepository(SQLAlchemyRepository[SettingsRecord]):
    """Data access for the singleton settings row."""

    model = SettingsRecord

    async def get_singleton(self) -> SettingsRecord | None:
        """Return the single settings row, if it exists."""
        result = await self.session.execute(select(SettingsRecord).limit(1))
        return result.scalar_one_or_none()
```

- [ ] **Step 2: Create services**

`backend/app/services/__init__.py`:
```python
"""Business logic layer — thin services over repositories."""
```

`backend/app/services/base.py`:
```python
"""Base service pattern: holds repositories, keeps services testable."""
from typing import Generic, TypeVar

from app.repositories.base import Repository

R = TypeVar("R", bound=Repository)


class Service(Generic[R]):
    """Lightweight base for all domain services."""

    def __init__(self, repository: R) -> None:
        self.repository = repository
```

`backend/app/services/chat.py`:
```python
"""Chat service — deterministic mock replies until AI is wired in."""
import time
from datetime import UTC, datetime

from app.config.settings import Settings
from app.exceptions import NotFoundError
from app.repositories.implementations import (
    ConversationRepository,
    MessageRepository,
)
from app.schemas.chat import ChatMessageRequest, ChatResponse


class ChatService:
    """Handles chat messages, persisting each turn and returning a mock reply."""

    def __init__(
        self,
        conversations: ConversationRepository,
        messages: MessageRepository,
        settings: Settings,
    ) -> None:
        self.conversations = conversations
        self.messages = messages
        self.settings = settings

    async def respond(self, request: ChatMessageRequest) -> ChatResponse:
        """Persist the exchange and return a deterministic placeholder reply."""
        started = time.perf_counter()

        conversation_id = request.conversation_id
        if conversation_id is None:
            conversation = await self.conversations.create(
                {"title": request.message[:60]}
            )
            conversation_id = conversation.id
        else:
            existing = await self.conversations.get(conversation_id)
            if existing is None:
                raise NotFoundError("Conversation not found")

        await self.messages.create(
            {"conversation_id": conversation_id, "role": "user", "content": request.message}
        )
        reply = (
            f"Understood, Sir. Processing “{request.message[:80]}” — "
            "response pipeline pending."
        )
        await self.messages.create(
            {"conversation_id": conversation_id, "role": "assistant", "content": reply}
        )

        latency_ms = int((time.perf_counter() - started) * 1000)
        return ChatResponse(
            reply=reply,
            conversation_id=conversation_id,
            model=self.settings.ai_model,
            latency_ms=latency_ms,
            created_at=datetime.now(UTC),
        )
```

`backend/app/memory/__init__.py`:
```python
"""Memory subsystem: persistence plus future vector search."""
```

`backend/app/memory/manager.py`:
```python
"""MemoryManager — CRUD over memory entries plus a search stub."""
from typing import Any

from app.repositories.implementations import MemoryRepository
from app.schemas.memory import MemoryEntryCreate, MemoryEntryUpdate


class MemoryManager:
    """Manages persisted memory entries for the assistant."""

    def __init__(self, repository: MemoryRepository) -> None:
        self.repository = repository

    async def list(self, *, limit: int, offset: int) -> tuple[list[Any], int]:
        """Return a page of memory entries plus the total count."""
        items = await self.repository.list(limit=limit, offset=offset)
        total = await self.repository.count()
        return list(items), total

    async def create(self, payload: MemoryEntryCreate) -> Any:
        """Create a memory entry; embedding hook returns None for now."""
        data = payload.model_dump(exclude_none=True)
        data["embedding"] = await self._embed(data["content"])
        return await self.repository.create(data)

    async def get(self, entry_id: str) -> Any:
        """Fetch a single memory entry."""
        return await self.repository.get(entry_id)

    async def update(self, entry_id: str, payload: MemoryEntryUpdate) -> Any:
        """Update a memory entry, re-embedding when content changes."""
        data = payload.model_dump(exclude_none=True)
        if "content" in data:
            data["embedding"] = await self._embed(data["content"])
        return await self.repository.update(entry_id, data)

    async def delete(self, entry_id: str) -> bool:
        """Delete a memory entry; returns False if it did not exist."""
        return await self.repository.delete(entry_id)

    async def search(self, query: str, limit: int = 10) -> list[Any]:
        """Deterministic stub search — highest-importance entries first.

        Replaced by a real vector index (pgvector / sqlite-vec) in the future.
        """
        _ = query  # reserved for semantic retrieval
        items = await self.repository.list(limit=limit, offset=0)
        return sorted(items, key=lambda entry: entry.importance, reverse=True)

    @staticmethod
    async def _embed(content: str) -> list[float] | None:
        """Placeholder for future vector embedding of memory content."""
        return None
```

`backend/app/tools/__init__.py`:
```python
"""Tool registry — the future home for callable AI tools."""
```

`backend/app/tools/registry.py`:
```python
"""ToolRegistry — register, list and invoke callable tools (no AI yet)."""
from collections.abc import Callable
from typing import Any

Handler = Callable[..., Any]


class ToolRegistry:
    """A small registry of named tools usable by future AI agents."""

    def __init__(self) -> None:
        self._tools: dict[str, tuple[str, Handler]] = {}

    def register(self, name: str, description: str, handler: Handler) -> None:
        """Register a tool by name with a human-readable description."""
        self._tools[name] = (description, handler)

    def list(self) -> list[dict[str, str]]:
        """Return metadata for every registered tool."""
        return [
            {"name": name, "description": description}
            for name, (description, _) in sorted(self._tools.items())
        ]

    def invoke(self, name: str, **kwargs: Any) -> Any:
        """Invoke a registered tool by name; raise KeyError when unknown."""
        if name not in self._tools:
            raise KeyError(f"Unknown tool: {name}")
        return self._tools[name][1](**kwargs)


def build_default_registry() -> ToolRegistry:
    """Return a registry preloaded with the built-in ping tool."""
    registry = ToolRegistry()

    def ping() -> dict[str, bool]:
        """Simple liveness tool used to validate the registry."""
        return {"pong": True}

    registry.register("ping", "Return pong to confirm the tool registry works.", ping)
    return registry
```

`backend/app/services/notifications.py`:
```python
"""Notification service — CRUD and read-state helpers."""
from typing import Any

from app.repositories.implementations import NotificationRepository
from app.schemas.notification import NotificationCreate


class NotificationService:
    """Manages notifications surfaced to the UI."""

    def __init__(self, repository: NotificationRepository) -> None:
        self.repository = repository

    async def list(self, *, limit: int, offset: int) -> tuple[list[Any], int]:
        items = await self.repository.list(limit=limit, offset=offset)
        total = await self.repository.count()
        return list(items), total

    async def create(self, payload: NotificationCreate) -> Any:
        return await self.repository.create(payload.model_dump(exclude_none=True))

    async def mark_read(self, notification_id: str, read: bool) -> Any:
        return await self.repository.update(notification_id, {"read": read})

    async def delete(self, notification_id: str) -> bool:
        return await self.repository.delete(notification_id)
```

`backend/app/services/reminders.py`:
```python
"""Reminder service — CRUD and due-item sweeps."""
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Reminder
from app.repositories.implementations import ReminderRepository
from app.schemas.reminder import ReminderCreate, ReminderUpdate
from app.utils.time import utcnow


class ReminderService:
    """Manages reminders and exposes a due-item query for the scheduler."""

    def __init__(self, repository: ReminderRepository, session: AsyncSession) -> None:
        self.repository = repository
        self.session = session

    async def list(self, *, limit: int, offset: int) -> tuple[list[Any], int]:
        items = await self.repository.list(limit=limit, offset=offset)
        total = await self.repository.count()
        return list(items), total

    async def create(self, payload: ReminderCreate) -> Any:
        return await self.repository.create(payload.model_dump(exclude_none=True))

    async def get(self, reminder_id: str) -> Any:
        return await self.repository.get(reminder_id)

    async def update(self, reminder_id: str, payload: ReminderUpdate) -> Any:
        return await self.repository.update(reminder_id, payload.model_dump(exclude_none=True))

    async def delete(self, reminder_id: str) -> bool:
        return await self.repository.delete(reminder_id)

    async def count_due(self) -> int:
        """Count reminders that are due and not yet completed."""
        result = await self.session.execute(
            select(Reminder).where(
                Reminder.completed.is_(False),
                Reminder.due_at.is_not(None),
                Reminder.due_at <= utcnow(),
            )
        )
        return len(result.scalars().all())
```

`backend/app/services/settings.py`:
```python
"""Settings service — reads and merges the singleton settings row."""
from typing import Any

from app.repositories.implementations import SettingsRepository


class SettingsService:
    """Access and update the persisted application settings singleton."""

    def __init__(self, repository: SettingsRepository) -> None:
        self.repository = repository

    async def get_all(self) -> dict[str, Any]:
        """Return the persisted settings dict (empty dict if none stored)."""
        row = await self.repository.get_singleton()
        return dict(row.data) if row else {}

    async def merge(self, updates: dict[str, Any]) -> dict[str, Any]:
        """Merge updates into the singleton settings row and return it."""
        row = await self.repository.get_singleton()
        if row is None:
            row = await self.repository.create({"data": dict(updates)})
            return dict(row.data)
        merged = {**row.data, **updates}
        updated = await self.repository.update(row.id, {"data": merged})
        return dict(updated.data)
```

`backend/app/services/projects.py`:
```python
"""Project service — CRUD over tracked projects."""
from typing import Any

from app.repositories.implementations import ProjectRepository
from app.schemas.project import ProjectCreate, ProjectUpdate


class ProjectService:
    """Manages projects tracked by the assistant."""

    def __init__(self, repository: ProjectRepository) -> None:
        self.repository = repository

    async def list(self, *, limit: int, offset: int) -> tuple[list[Any], int]:
        items = await self.repository.list(limit=limit, offset=offset)
        total = await self.repository.count()
        return list(items), total

    async def create(self, payload: ProjectCreate) -> Any:
        return await self.repository.create(payload.model_dump(exclude_none=True))

    async def get(self, project_id: str) -> Any:
        return await self.repository.get(project_id)

    async def update(self, project_id: str, payload: ProjectUpdate) -> Any:
        return await self.repository.update(project_id, payload.model_dump(exclude_none=True))

    async def delete(self, project_id: str) -> bool:
        return await self.repository.delete(project_id)
```

`backend/app/services/system.py`:
```python
"""System service — runtime metadata for the /system/info endpoint."""
import platform

from app.config.settings import Settings


class SystemService:
    """Returns static runtime information about the backend process."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def info(self) -> dict[str, str]:
        """Return name, version, environment and interpreter details."""
        return {
            "name": self.settings.app_name,
            "version": self.settings.app_version,
            "environment": self.settings.environment,
            "python": platform.python_version(),
            "platform": platform.system(),
        }
```

- [ ] **Step 3: Write failing tests**

`backend/tests/unit/test_repositories.py`:
```python
"""Tests for the generic SQLAlchemy repository."""
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database.base import Base
from app.models import MemoryEntry, SettingsRecord
from app.repositories.implementations import MemoryRepository, SettingsRepository


@pytest.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


async def test_memory_repository_crud(session) -> None:
    repo = MemoryRepository(session)
    created = await repo.create({"kind": "note", "content": "remember this", "importance": 0.8})
    assert created.id

    fetched = await repo.get(created.id)
    assert fetched is not None and fetched.content == "remember this"

    updated = await repo.update(created.id, {"importance": 0.2})
    assert updated is not None and updated.importance == 0.2

    assert await repo.count() == 1
    assert await repo.delete(created.id) is True
    assert await repo.get(created.id) is None


async def test_settings_repository_singleton(session) -> None:
    repo = SettingsRepository(session)
    assert await repo.get_singleton() is None
    await repo.create({"data": {"theme": "dark"}})
    row = await repo.get_singleton()
    assert row is not None and row.data["theme"] == "dark"
```

`backend/tests/unit/test_services.py`:
```python
"""Tests for service-layer logic (mock chat, settings merge, due count)."""
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config.settings import Settings
from app.database.base import Base
from app.models import Reminder
from app.repositories.implementations import (
    ConversationRepository,
    MessageRepository,
    ReminderRepository,
    SettingsRepository,
)
from app.schemas.chat import ChatMessageRequest
from app.services.chat import ChatService
from app.services.reminders import ReminderService
from app.services.settings import SettingsService
from app.utils.time import utcnow


@pytest.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


async def test_chat_service_returns_mock_reply(session) -> None:
    settings = Settings(_env_file=None)
    service = ChatService(
        ConversationRepository(session),
        MessageRepository(session),
        settings,
    )
    response = await service.respond(ChatMessageRequest(message="Hello JARVIS"))
    assert response.conversation_id
    assert "Hello JARVIS" in response.reply
    assert response.model == settings.ai_model


async def test_settings_service_merge(session) -> None:
    service = SettingsService(SettingsRepository(session))
    assert await service.get_all() == {}
    await service.merge({"theme": "dark"})
    await service.merge({"voice": "jarvis"})
    data = await service.get_all()
    assert data == {"theme": "dark", "voice": "jarvis"}


async def test_reminder_service_counts_due(session) -> None:
    session.add(
        Reminder(
            title="Pay bills",
            due_at=utcnow(),
            completed=False,
        )
    )
    session.add(
        Reminder(
            title="Tomorrow",
            due_at=utcnow(),
            completed=True,
        )
    )
    await session.commit()
    service = ReminderService(ReminderRepository(session), session)
    assert await service.count_due() == 1
```

`backend/tests/unit/test_memory_tools.py`:
```python
"""Tests for the memory manager search stub and the tool registry."""
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database.base import Base
from app.memory.manager import MemoryManager
from app.models import MemoryEntry
from app.repositories.implementations import MemoryRepository
from app.schemas.memory import MemoryEntryCreate
from app.tools.registry import build_default_registry


@pytest.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


async def test_memory_manager_search_ranks_by_importance(session) -> None:
    manager = MemoryManager(MemoryRepository(session))
    await manager.create(MemoryEntryCreate(kind="note", content="low", importance=0.2))
    await manager.create(MemoryEntryCreate(kind="note", content="high", importance=0.9))
    results = await manager.search("anything", limit=10)
    assert results[0].content == "high"


def test_tool_registry_lists_and_invokes() -> None:
    registry = build_default_registry()
    assert registry.invoke("ping") == {"pong": True}
    names = [tool["name"] for tool in registry.list()]
    assert "ping" in names
```

- [ ] **Step 4: Run tests to green**

Run: `cd backend && uv run pytest tests/unit/test_repositories.py tests/unit/test_services.py tests/unit/test_memory_tools.py -q`
Expected: 7 passed (repo 2, services 3, memory/tools 2).

- [ ] **Step 5: ruff + full suite**

Run: `cd backend && uv run pytest -q` → all pass.
Run: `uv run ruff check .` → 0 errors.

- [ ] **Step 6: Commit**

```bash
cd backend
git add -A
git commit -m "feat(backend): repository interface + implementations and domain services"
```

---

### Task 5: WebSocket infrastructure + scheduler

**Files:**
- Create: `backend/app/websocket/__init__.py`, `backend/app/websocket/protocol.py`, `backend/app/websocket/manager.py`
- Create: `backend/app/scheduler/__init__.py`, `backend/app/scheduler/scheduler.py`
- Test: `backend/tests/websocket/test_websocket.py`, `backend/tests/unit/test_scheduler.py`

**Interfaces:**
- Produces: `envelope(type_, payload=None) -> dict`; message constants `MSG_HELLO/PING/PONG/HEARTBEAT/BROADCAST/ERROR/SYSTEM`.
- Produces: `ConnectionManager` with `connect`, `disconnect`, `send`, `broadcast`, `handle(websocket)`, `active_count`.
- Produces: `Scheduler` with `register(name, callback, interval_seconds)`, `start()`, `stop()`.

- [ ] **Step 1: Create websocket module**

`backend/app/websocket/__init__.py`:
```python
"""WebSocket infrastructure: envelope protocol and connection manager."""
```

`backend/app/websocket/protocol.py`:
```python
"""WebSocket message envelope helpers and type constants."""
from typing import Any

MSG_HELLO = "hello"
MSG_PING = "ping"
MSG_PONG = "pong"
MSG_HEARTBEAT = "heartbeat"
MSG_BROADCAST = "broadcast"
MSG_ERROR = "error"
MSG_SYSTEM = "system"


def envelope(type_: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    """Build a standard message envelope for the WebSocket protocol."""
    return {"type": type_, "payload": payload or {}}
```

`backend/app/websocket/manager.py`:
```python
"""ConnectionManager: connect/disconnect/send/broadcast/heartbeat for /ws."""
import asyncio
from typing import Any

from fastapi import WebSocket

from app.utils.logging import get_logger
from app.websocket.protocol import MSG_HELLO, MSG_PING, MSG_PONG, envelope


class ConnectionManager:
    """Tracks live clients and provides send/broadcast primitives."""

    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()
        self._logger = get_logger("websocket")

    @property
    def active_count(self) -> int:
        """Number of currently connected clients."""
        return len(self._connections)

    async def connect(self, websocket: WebSocket) -> None:
        """Accept a connection, register it, and greet the client."""
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)
        await self.send(websocket, envelope(MSG_HELLO, {"active": self.active_count}))
        self._logger.info(
            "websocket_connected",
            extra={"extra_fields": {"active": self.active_count}},
        )

    async def disconnect(self, websocket: WebSocket) -> None:
        """Unregister a client from the connection pool."""
        async with self._lock:
            self._connections.discard(websocket)
        self._logger.info(
            "websocket_disconnected",
            extra={"extra_fields": {"active": self.active_count}},
        )

    async def send(self, websocket: WebSocket, data: dict[str, Any]) -> None:
        """Send a JSON envelope to one client, dropping it on failure."""
        try:
            await websocket.send_json(data)
        except Exception:
            await self.disconnect(websocket)

    async def broadcast(self, data: dict[str, Any]) -> None:
        """Send a JSON envelope to every connected client."""
        for client in list(self._connections):
            await self.send(client, data)

    async def handle(self, websocket: WebSocket) -> None:
        """Run the receive loop: respond to pings, ignore the rest."""
        await self.connect(websocket)
        try:
            while True:
                raw = await websocket.receive_json()
                if raw.get("type") == MSG_PING:
                    await self.send(
                        websocket, envelope(MSG_PONG, {"ts": raw.get("ts")})
                    )
        except Exception:
            pass
        finally:
            await self.disconnect(websocket)
```

- [ ] **Step 2: Create scheduler**

`backend/app/scheduler/__init__.py`:
```python
"""Asyncio scheduler for periodic background tasks."""
```

`backend/app/scheduler/scheduler.py`:
```python
"""Minimal asyncio periodic-task scheduler with graceful shutdown."""
import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime

from app.utils.logging import get_logger

Callback = Callable[[], Awaitable[None]]


@dataclass
class ScheduledTask:
    """A named periodic callback and its interval."""

    name: str
    callback: Callback
    interval_seconds: float


class Scheduler:
    """Runs registered async callbacks on fixed intervals until stopped."""

    def __init__(self) -> None:
        self._registry: list[ScheduledTask] = []
        self._runners: dict[str, asyncio.Task] = {}
        self._logger = get_logger("scheduler")

    def register(self, name: str, callback: Callback, interval_seconds: float) -> None:
        """Register a periodic callback (safe before start())."""
        self._registry.append(ScheduledTask(name, callback, interval_seconds))

    async def start(self) -> None:
        """Spawn a runner task for every registered callback."""
        for task in self._registry:
            self._runners[task.name] = asyncio.create_task(
                self._run(task), name=f"scheduler:{task.name}"
            )
        self._logger.info(
            "scheduler_started",
            extra={"extra_fields": {"tasks": list(self._runners)}},
        )

    async def stop(self) -> None:
        """Cancel all runner tasks and await their completion."""
        for name in list(self._runners):
            self._runners[name].cancel()
        for name in list(self._runners):
            try:
                await self._runners[name]
            except asyncio.CancelledError:
                pass
        self._runners.clear()
        self._logger.info("scheduler_stopped")

    async def _run(self, task: ScheduledTask) -> None:
        """Execute one callback repeatedly, skipping if it overruns."""
        while True:
            started = datetime.now(UTC)
            try:
                await task.callback()
            except Exception as exc:  # noqa: BLE001
                self._logger.error(
                    "scheduler_task_failed",
                    extra={"extra_fields": {"task": task.name, "error": str(exc)}},
                )
            elapsed = (datetime.now(UTC) - started).total_seconds()
            await asyncio.sleep(max(0.0, task.interval_seconds - elapsed))
```

- [ ] **Step 3: Write failing tests**

`backend/tests/websocket/__init__.py`:
```python
"""WebSocket tests."""
```

`backend/tests/websocket/test_websocket.py`:
```python
"""Tests for ConnectionManager (unit) and the /ws endpoint (integration)."""
import asyncio
import pytest

from app.websocket.manager import ConnectionManager
from app.websocket.protocol import MSG_BROADCAST, MSG_HELLO, MSG_PING, MSG_PONG, envelope


class FakeWebSocket:
    """Minimal stand-in for starlette.WebSocket."""

    def __init__(self) -> None:
        self.accepted = False
        self.sent: list[dict] = []
        self.connected = True

    async def accept(self) -> None:
        self.accepted = True

    async def send_json(self, data: dict) -> None:
        self.sent.append(data)

    async def receive_json(self) -> dict:
        await asyncio.sleep(3600)

    async def close(self) -> None:
        self.connected = False


async def test_manager_connect_send_broadcast() -> None:
    manager = ConnectionManager()
    ws1 = FakeWebSocket()
    ws2 = FakeWebSocket()
    await manager.connect(ws1)
    await manager.connect(ws2)
    assert manager.active_count == 2
    assert ws1.sent[0]["type"] == MSG_HELLO

    await manager.broadcast(envelope(MSG_BROADCAST, {"msg": "hi"}))
    assert ws1.sent[-1]["type"] == MSG_BROADCAST
    assert ws2.sent[-1]["type"] == MSG_BROADCAST

    await manager.disconnect(ws1)
    assert manager.active_count == 1
```

`backend/tests/unit/test_scheduler.py`:
```python
"""Tests for the asyncio periodic scheduler."""
import asyncio

from app.scheduler.scheduler import Scheduler


async def test_scheduler_runs_and_stops() -> None:
    runs = []
    scheduler = Scheduler()

    async def tick() -> None:
        runs.append(1)

    scheduler.register("tick", tick, interval_seconds=0.01)
    await scheduler.start()
    await asyncio.sleep(0.05)
    await scheduler.stop()
    assert len(runs) >= 3


async def test_scheduler_keeps_running_on_callback_error() -> None:
    runs = []

    async def flaky() -> None:
        if not runs:
            raise RuntimeError("boom")
        runs.append(1)

    scheduler = Scheduler()
    scheduler.register("flaky", flaky, interval_seconds=0.01)
    await scheduler.start()
    await asyncio.sleep(0.04)
    await scheduler.stop()
    assert len(runs) >= 1
```

- [ ] **Step 4: Run tests to green**

Run: `cd backend && uv run pytest tests/websocket tests/unit/test_scheduler.py -q`
Expected: 3 passed (ws 1, scheduler 2).

- [ ] **Step 5: Commit**

```bash
cd backend
git add -A
git commit -m "feat(backend): websocket connection manager and asyncio scheduler"
```

---

### Task 6: Middleware + dependencies + exception handlers

**Files:**
- Create: `backend/app/middleware/__init__.py`, `backend/app/middleware/request_logging.py`, `backend/app/middleware/cors.py`
- Create: `backend/app/dependencies/__init__.py`, `backend/app/dependencies/database.py`, `backend/app/dependencies/settings.py`
- Create: `backend/app/exceptions/handlers.py`
- Test: `backend/tests/api/test_middleware.py`

**Interfaces:**
- Produces: `RequestLoggingMiddleware` (logs method/path/status/duration, sets `X-Process-Time-Ms`); `add_cors(app, origins)`.
- Produces: `get_db_session(request)` async generator yielding `AsyncSession`; `get_settings()` dependency re-export.
- Produces: `register_exception_handlers(app)` → uniform `ErrorBody` JSON for `JARVISError` and `RequestValidationError`.

- [ ] **Step 1: Create middleware**

`backend/app/middleware/__init__.py`:
```python
"""HTTP middleware: request logging/timing and CORS."""
```

`backend/app/middleware/request_logging.py`:
```python
"""Middleware that logs every request with method, path, status and duration."""
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.utils.logging import get_logger

logger = get_logger("http")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Records request metadata and adds a process-time response header."""

    async def dispatch(self, request: Request, call_next):
        started = time.perf_counter()
        response = await call_next(request)
        duration_ms = int((time.perf_counter() - started) * 1000)
        logger.info(
            "request_completed",
            extra={
                "extra_fields": {
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "duration_ms": duration_ms,
                }
            },
        )
        response.headers["X-Process-Time-Ms"] = str(duration_ms)
        return response
```

`backend/app/middleware/cors.py`:
```python
"""CORS configuration helper."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def add_cors(app: FastAPI, origins: list[str]) -> None:
    """Register permissive CORS for the configured origins."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
```

- [ ] **Step 2: Create dependencies**

`backend/app/dependencies/__init__.py`:
```python
"""FastAPI dependency-injection providers."""
```

`backend/app/dependencies/database.py`:
```python
"""DI: provide an async database session per request."""
from collections.abc import AsyncGenerator

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession


async def get_db_session(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """Yield a session created by the app's lifespan-built factory."""
    session_factory = request.app.state.session_factory
    async with session_factory() as session:
        yield session
```

`backend/app/dependencies/settings.py`:
```python
"""DI: provide application settings to endpoints."""
from app.config.settings import Settings, get_settings

__all__ = ["Settings", "get_settings"]
```

- [ ] **Step 3: Create exception handlers**

`backend/app/exceptions/handlers.py`:
```python
"""FastAPI exception handlers mapping domain errors to a uniform envelope."""
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.exceptions.base import JARVISError


def _error_body(status: int, code: str, message: str, detail: Any = None) -> dict[str, Any]:
    """Build the standardized error response body."""
    return {
        "type": "about:blank",
        "title": message,
        "status": status,
        "code": code,
        "detail": detail,
    }


def register_exception_handlers(app: FastAPI) -> None:
    """Attach handlers for domain errors and request-validation errors."""

    @app.exception_handler(JARVISError)
    async def jarvis_error_handler(_: Request, exc: JARVISError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(exc.status_code, exc.code, exc.message, exc.detail),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        _: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_error_body(
                422, "validation_error", "Request validation failed", exc.errors()
            ),
        )
```

- [ ] **Step 4: Write failing tests**

`backend/tests/api/test_middleware.py`:
```python
"""Tests for middleware behavior (timing header, CORS)."""
import pytest
from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient

from app.config.settings import Settings
from app.main import create_app


@pytest.mark.asyncio
async def test_process_time_header_and_cors(tmp_path) -> None:
    settings = Settings(
        _env_file=None,
        environment="testing",
        database_url=f"sqlite+aiosqlite:///{tmp_path / 'mw.db'}",
        log_level="CRITICAL",
        cors_origins=["http://localhost:5173"],
    )
    application = create_app(settings)
    async with LifespanManager(application):
        transport = ASGITransport(app=application)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/")
            assert "x-process-time-ms" in response.headers
            assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
```

- [ ] **Step 5: Create `main.py` minimal + run tests**

Create minimal `backend/app/main.py` (full version lands in Task 7):
```python
"""Application bootstrap factory (minimal for middleware tests)."""
from fastapi import FastAPI

from app.config.settings import Settings, get_settings
from app.middleware.cors import add_cors
from app.middleware.request_logging import RequestLoggingMiddleware


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the FastAPI application with middleware configured."""
    settings = settings or get_settings()
    app = FastAPI(title=settings.app_name, version=settings.app_version, debug=settings.debug)
    add_cors(app, settings.cors_origins)
    app.add_middleware(RequestLoggingMiddleware)

    @app.get("/")
    async def root() -> dict:
        return {"name": settings.app_name, "status": "ok"}

    return app


app = create_app()
```

Run: `cd backend && uv run pytest tests/api/test_middleware.py -q`
Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
cd backend
git add -A
git commit -m "feat(backend): request middleware, CORS, DI providers, exception handlers"
```

---

### Task 7: API routers + app bootstrap (main)

**Files:**
- Create: `backend/tests/conftest.py` (app/client fixtures)
- Create: `backend/app/api/__init__.py`, `backend/app/api/v1/__init__.py`, `backend/app/api/v1/router.py`
- Create: `backend/app/api/v1/routers/__init__.py` + `health.py`, `system.py`, `chat.py`, `memory.py`, `notifications.py`, `reminders.py`, `settings.py`, `projects.py`
- Rewrite: `backend/app/main.py` (full factory + lifespan)
- Test: `backend/tests/api/test_health.py`, `test_system.py`, `test_chat.py`, `test_memory.py`, `test_settings.py`, `test_errors.py`

**Interfaces:**
- Consumes: all routers from Tasks 1–6.
- Produces: `create_app(settings=None) -> FastAPI` with lifespan that builds engine/session_factory, starts scheduler (reminder sweep), registers WS route, middleware, exception handlers; `app = create_app()` module-level instance.
- Produces WS endpoint `/ws` using `app.state.websocket_manager`.

- [ ] **Step 1: Create conftest + fixtures**

`backend/tests/conftest.py`:
```python
"""Shared pytest fixtures: test settings, lifespan-managed app, HTTP client."""
import pytest
import pytest_asyncio
from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient

from app.config.settings import Settings
from app.database.base import Base
from app.main import create_app


@pytest.fixture
def settings(tmp_path) -> Settings:
    """Test settings backed by a temp SQLite file."""
    return Settings(
        _env_file=None,
        environment="testing",
        debug=True,
        database_url=f"sqlite+aiosqlite:///{tmp_path / 'test.db'}",
        database_echo=False,
        log_level="CRITICAL",
        cors_origins=["http://localhost:5173"],
    )


@pytest_asyncio.fixture
async def app(settings):
    """App under test with schema created and lifespan running."""
    application = create_app(settings)
    async with LifespanManager(application):
        engine = application.state.engine
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        yield application


@pytest_asyncio.fixture
async def client(app):
    """Async HTTP client wired to the ASGI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client
```

- [ ] **Step 2: Create v1 routers**

`backend/app/api/__init__.py`:
```python
"""API layer (versioned HTTP endpoints)."""
```

`backend/app/api/v1/__init__.py`:
```python
"""Version 1 of the public API."""
```

`backend/app/api/v1/routers/__init__.py`:
```python
"""Router modules, one file per resource."""
```

`backend/app/api/v1/routers/health.py`:
```python
"""Health endpoints: liveness and readiness probes."""
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db_session
from app.exceptions import ServiceUnavailableError

router = APIRouter(tags=["health"])


@router.get("/health/live")
async def health_live() -> dict[str, str]:
    """Liveness probe — returns 200 while the process is up."""
    return {"status": "ok"}


@router.get("/health/ready")
async def health_ready(
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, str]:
    """Readiness probe — verifies the database is reachable."""
    try:
        await session.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001
        raise ServiceUnavailableError("Database not reachable") from exc
    return {"status": "ready"}
```

`backend/app/api/v1/routers/system.py`:
```python
"""System endpoints: runtime metadata."""
from fastapi import APIRouter, Depends

from app.config.settings import Settings
from app.dependencies.settings import get_settings
from app.services.system import SystemService

router = APIRouter(tags=["system"])


@router.get("/system/info")
async def system_info(
    settings: Settings = Depends(get_settings),
) -> dict[str, str]:
    """Return name, version and runtime environment metadata."""
    return SystemService(settings).info()
```

`backend/app/api/v1/routers/chat.py`:
```python
"""Chat endpoints — deterministic mock responses, streaming-ready."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import Settings
from app.dependencies.database import get_db_session
from app.dependencies.settings import get_settings
from app.repositories.implementations import ConversationRepository, MessageRepository
from app.schemas.chat import ChatMessageRequest, ChatResponse
from app.services.chat import ChatService

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/messages", response_model=ChatResponse)
async def chat_message(
    payload: ChatMessageRequest,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ChatResponse:
    """Persist a message turn and return a mock assistant reply."""
    service = ChatService(
        ConversationRepository(session), MessageRepository(session), settings
    )
    return await service.respond(payload)
```

`backend/app/api/v1/routers/memory.py`:
```python
"""Memory endpoints — placeholder CRUD for assistant memory."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db_session
from app.exceptions import NotFoundError
from app.memory.manager import MemoryManager
from app.repositories.implementations import MemoryRepository
from app.schemas.common import ListResponse
from app.schemas.memory import MemoryEntryCreate, MemoryEntryRead, MemoryEntryUpdate

router = APIRouter(prefix="/memory", tags=["memory"])


@router.get("/entries", response_model=ListResponse[MemoryEntryRead])
async def list_memory_entries(
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db_session),
) -> ListResponse[MemoryEntryRead]:
    """Return a page of memory entries."""
    manager = MemoryManager(MemoryRepository(session))
    items, total = await manager.list(limit=limit, offset=offset)
    return ListResponse(items=items, total=total)


@router.post("/entries", response_model=MemoryEntryRead, status_code=201)
async def create_memory_entry(
    payload: MemoryEntryCreate,
    session: AsyncSession = Depends(get_db_session),
):
    """Create a memory entry."""
    manager = MemoryManager(MemoryRepository(session))
    return await manager.create(payload)


@router.get("/entries/{entry_id}", response_model=MemoryEntryRead)
async def get_memory_entry(
    entry_id: str,
    session: AsyncSession = Depends(get_db_session),
):
    """Fetch a single memory entry."""
    manager = MemoryManager(MemoryRepository(session))
    entry = await manager.get(entry_id)
    if entry is None:
        raise NotFoundError("Memory entry not found")
    return entry


@router.patch("/entries/{entry_id}", response_model=MemoryEntryRead)
async def update_memory_entry(
    entry_id: str,
    payload: MemoryEntryUpdate,
    session: AsyncSession = Depends(get_db_session),
):
    """Update a memory entry."""
    manager = MemoryManager(MemoryRepository(session))
    entry = await manager.update(entry_id, payload)
    if entry is None:
        raise NotFoundError("Memory entry not found")
    return entry


@router.delete("/entries/{entry_id}", status_code=204)
async def delete_memory_entry(
    entry_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a memory entry."""
    manager = MemoryManager(MemoryRepository(session))
    deleted = await manager.delete(entry_id)
    if not deleted:
        raise NotFoundError("Memory entry not found")
```

`backend/app/api/v1/routers/notifications.py`:
```python
"""Notification endpoints."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db_session
from app.exceptions import NotFoundError
from app.repositories.implementations import NotificationRepository
from app.schemas.common import ListResponse
from app.schemas.notification import NotificationCreate, NotificationRead
from app.services.notifications import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=ListResponse[NotificationRead])
async def list_notifications(
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db_session),
) -> ListResponse[NotificationRead]:
    """Return a page of notifications."""
    service = NotificationService(NotificationRepository(session))
    items, total = await service.list(limit=limit, offset=offset)
    return ListResponse(items=items, total=total)


@router.post("", response_model=NotificationRead, status_code=201)
async def create_notification(
    payload: NotificationCreate,
    session: AsyncSession = Depends(get_db_session),
):
    """Create a notification."""
    service = NotificationService(NotificationRepository(session))
    return await service.create(payload)


@router.patch("/{notification_id}/read", response_model=NotificationRead)
async def mark_notification_read(
    notification_id: str,
    read: bool,
    session: AsyncSession = Depends(get_db_session),
):
    """Mark a notification read/unread."""
    service = NotificationService(NotificationRepository(session))
    notification = await service.mark_read(notification_id, read)
    if notification is None:
        raise NotFoundError("Notification not found")
    return notification


@router.delete("/{notification_id}", status_code=204)
async def delete_notification(
    notification_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a notification."""
    service = NotificationService(NotificationRepository(session))
    if not await service.delete(notification_id):
        raise NotFoundError("Notification not found")
```

`backend/app/api/v1/routers/reminders.py`:
```python
"""Reminder endpoints."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db_session
from app.exceptions import NotFoundError
from app.repositories.implementations import ReminderRepository
from app.schemas.common import ListResponse
from app.schemas.reminder import ReminderCreate, ReminderRead, ReminderUpdate
from app.services.reminders import ReminderService

router = APIRouter(prefix="/reminders", tags=["reminders"])


@router.get("", response_model=ListResponse[ReminderRead])
async def list_reminders(
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db_session),
) -> ListResponse[ReminderRead]:
    """Return a page of reminders."""
    service = ReminderService(ReminderRepository(session), session)
    items, total = await service.list(limit=limit, offset=offset)
    return ListResponse(items=items, total=total)


@router.post("", response_model=ReminderRead, status_code=201)
async def create_reminder(
    payload: ReminderCreate,
    session: AsyncSession = Depends(get_db_session),
):
    """Create a reminder."""
    service = ReminderService(ReminderRepository(session), session)
    return await service.create(payload)


@router.patch("/{reminder_id}", response_model=ReminderRead)
async def update_reminder(
    reminder_id: str,
    payload: ReminderUpdate,
    session: AsyncSession = Depends(get_db_session),
):
    """Update a reminder."""
    service = ReminderService(ReminderRepository(session), session)
    reminder = await service.update(reminder_id, payload)
    if reminder is None:
        raise NotFoundError("Reminder not found")
    return reminder


@router.delete("/{reminder_id}", status_code=204)
async def delete_reminder(
    reminder_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a reminder."""
    service = ReminderService(ReminderRepository(session), session)
    if not await service.delete(reminder_id):
        raise NotFoundError("Reminder not found")
```

`backend/app/api/v1/routers/settings.py`:
```python
"""Application settings endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db_session
from app.repositories.implementations import SettingsRepository
from app.schemas.settings import SettingsRead, SettingsUpdate
from app.services.settings import SettingsService

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsRead)
async def get_settings(session: AsyncSession = Depends(get_db_session)) -> SettingsRead:
    """Return the persisted application settings."""
    service = SettingsService(SettingsRepository(session))
    return SettingsRead(data=await service.get_all())


@router.patch("", response_model=SettingsRead)
async def patch_settings(
    payload: SettingsUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> SettingsRead:
    """Merge a partial update into the persisted settings."""
    service = SettingsService(SettingsRepository(session))
    return SettingsRead(data=await service.merge(payload.data))
```

`backend/app/api/v1/routers/projects.py`:
```python
"""Project endpoints."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db_session
from app.exceptions import NotFoundError
from app.repositories.implementations import ProjectRepository
from app.schemas.common import ListResponse
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.services.projects import ProjectService

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=ListResponse[ProjectRead])
async def list_projects(
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db_session),
) -> ListResponse[ProjectRead]:
    """Return a page of projects."""
    service = ProjectService(ProjectRepository(session))
    items, total = await service.list(limit=limit, offset=offset)
    return ListResponse(items=items, total=total)


@router.post("", response_model=ProjectRead, status_code=201)
async def create_project(
    payload: ProjectCreate,
    session: AsyncSession = Depends(get_db_session),
):
    """Create a project."""
    service = ProjectService(ProjectRepository(session))
    return await service.create(payload)


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: str,
    session: AsyncSession = Depends(get_db_session),
):
    """Fetch a single project."""
    service = ProjectService(ProjectRepository(session))
    project = await service.get(project_id)
    if project is None:
        raise NotFoundError("Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: str,
    payload: ProjectUpdate,
    session: AsyncSession = Depends(get_db_session),
):
    """Update a project."""
    service = ProjectService(ProjectRepository(session))
    project = await service.update(project_id, payload)
    if project is None:
        raise NotFoundError("Project not found")
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a project."""
    service = ProjectService(ProjectRepository(session))
    if not await service.delete(project_id):
        raise NotFoundError("Project not found")
```

`backend/app/api/v1/router.py`:
```python
"""Aggregates all v1 routers under the /api/v1 prefix."""
from fastapi import APIRouter

from app.api.v1.routers import (
    chat,
    health,
    memory,
    notifications,
    projects,
    reminders,
    settings,
    system,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(system.router)
api_router.include_router(chat.router)
api_router.include_router(memory.router)
api_router.include_router(notifications.router)
api_router.include_router(reminders.router)
api_router.include_router(settings.router)
api_router.include_router(projects.router)
```

- [ ] **Step 3: Full `main.py`**

Rewrite `backend/app/main.py`:
```python
"""Application bootstrap: factory, lifespan, middleware, routers, WebSocket."""
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, WebSocket

from app.api.v1.router import api_router
from app.config.settings import Settings, get_settings
from app.core.constants import REMINDER_SWEEP_INTERVAL_SECONDS
from app.database.engine import build_engine, dispose_engine
from app.database.session import build_session_factory
from app.exceptions.handlers import register_exception_handlers
from app.middleware.cors import add_cors
from app.middleware.request_logging import RequestLoggingMiddleware
from app.repositories.implementations import ReminderRepository
from app.scheduler.scheduler import Scheduler
from app.services.reminders import ReminderService
from app.utils.logging import configure_logging, get_logger
from app.websocket.manager import ConnectionManager

logger = get_logger("app")


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build and configure the FastAPI application."""
    settings = settings or get_settings()
    configure_logging(settings.log_level, settings.log_format)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        """Start database, scheduler and WebSocket manager; tear down cleanly."""
        logger.info(
            "startup_begin",
            extra={"extra_fields": {"environment": settings.environment}},
        )
        engine = build_engine(settings)
        app.state.engine = engine
        app.state.session_factory = build_session_factory(engine)
        app.state.websocket_manager = ConnectionManager()

        scheduler = Scheduler()
        app.state.scheduler = scheduler

        async def reminder_sweep() -> None:
            """Periodically count due reminders and log them (scheduler demo)."""
            async with app.state.session_factory() as session:
                count = await ReminderService(
                    ReminderRepository(session), session
                ).count_due()
                logger.info(
                    "reminder_sweep",
                    extra={"extra_fields": {"due": count}},
                )

        scheduler.register(
            "reminder_sweep", reminder_sweep, REMINDER_SWEEP_INTERVAL_SECONDS
        )
        await scheduler.start()

        logger.info(
            "startup_complete",
            extra={"extra_fields": {"environment": settings.environment}},
        )
        try:
            yield
        finally:
            await scheduler.stop()
            await dispose_engine(engine)
            logger.info(
                "shutdown_complete",
                extra={"extra_fields": {"environment": settings.environment}},
            )

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        debug=settings.debug,
        lifespan=lifespan,
    )
    app.state.settings = settings

    add_cors(app, settings.cors_origins)
    app.add_middleware(RequestLoggingMiddleware)
    register_exception_handlers(app)

    app.include_router(api_router)

    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket) -> None:
        """Handle one WebSocket client connection (hello/ping/broadcast)."""
        manager: ConnectionManager = app.state.websocket_manager
        await manager.handle(websocket)

    @app.get("/")
    async def root() -> dict:
        """Root landing payload with links to docs and health."""
        return {
            "name": settings.app_name,
            "version": settings.app_version,
            "docs": "/docs",
            "health": "/api/v1/health/live",
        }

    return app


app = create_app()
```

- [ ] **Step 4: Write failing API tests**

`backend/tests/api/test_health.py`:
```python
"""Tests for liveness/readiness probes."""
from httpx import AsyncClient


async def test_health_live(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_health_ready(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready"}
```

`backend/tests/api/test_system.py`:
```python
"""Tests for the /system/info endpoint."""
from httpx import AsyncClient


async def test_system_info(client: AsyncClient) -> None:
    response = await client.get("/api/v1/system/info")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "IronmanJARVIS"
    assert "python" in body
    assert body["environment"] == "testing"
```

`backend/tests/api/test_chat.py`:
```python
"""Tests for the mock chat endpoint."""
from httpx import AsyncClient


async def test_chat_returns_mock_reply(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/chat/messages",
        json={"message": "What is my focus today?"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["conversation_id"]
    assert body["model"]
    assert body["latency_ms"] >= 0


async def test_chat_with_existing_conversation(client: AsyncClient) -> None:
    first = await client.post("/api/v1/chat/messages", json={"message": "hello"})
    conversation_id = first.json()["conversation_id"]
    second = await client.post(
        "/api/v1/chat/messages",
        json={"message": "again", "conversation_id": conversation_id},
    )
    assert second.json()["conversation_id"] == conversation_id


async def test_chat_unknown_conversation_404(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/chat/messages",
        json={"message": "hi", "conversation_id": "does-not-exist"},
    )
    assert response.status_code == 404
```

`backend/tests/api/test_memory.py`:
```python
"""Tests for memory entry CRUD."""
from httpx import AsyncClient


async def test_memory_crud_flow(client: AsyncClient) -> None:
    created = await client.post(
        "/api/v1/memory/entries",
        json={"kind": "fact", "content": "Sir prefers dark mode", "importance": 0.9},
    )
    assert created.status_code == 201
    entry_id = created.json()["id"]

    fetched = await client.get(f"/api/v1/memory/entries/{entry_id}")
    assert fetched.status_code == 200
    assert fetched.json()["content"] == "Sir prefers dark mode"

    updated = await client.patch(
        f"/api/v1/memory/entries/{entry_id}", json={"importance": 0.4}
    )
    assert updated.json()["importance"] == 0.4

    listing = await client.get("/api/v1/memory/entries")
    assert listing.json()["total"] == 1

    deleted = await client.delete(f"/api/v1/memory/entries/{entry_id}")
    assert deleted.status_code == 204
```

`backend/tests/api/test_settings.py`:
```python
"""Tests for the settings singleton endpoint."""
from httpx import AsyncClient


async def test_settings_get_and_merge(client: AsyncClient) -> None:
    got = await client.get("/api/v1/settings")
    assert got.status_code == 200
    assert got.json()["data"] == {}

    merged = await client.patch("/api/v1/settings", json={"data": {"theme": "dark"}})
    assert merged.json()["data"]["theme"] == "dark"

    merged2 = await client.patch("/api/v1/settings", json={"data": {"voice": "jarvis"}})
    assert merged2.json()["data"] == {"theme": "dark", "voice": "jarvis"}
```

`backend/tests/api/test_errors.py`:
```python
"""Tests for the uniform error envelope."""
from httpx import AsyncClient


async def test_validation_error_envelope(client: AsyncClient) -> None:
    response = await client.post("/api/v1/memory/entries", json={"content": ""})
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "validation_error"
    assert body["status"] == 422


async def test_not_found_error_envelope(client: AsyncClient) -> None:
    response = await client.get("/api/v1/memory/entries/nope")
    assert response.status_code == 404
    body = response.json()
    assert body["code"] == "not_found"
    assert body["title"] == "Memory entry not found"
```

- [ ] **Step 5: Run full test suite**

Run: `cd backend && uv run pytest -q`
Expected: all tests pass (config 2, logging 2, models 2, repos 2, services 3, ws 1, scheduler 2, middleware 1, api ~12).

- [ ] **Step 6: ruff**

Run: `cd backend && uv run ruff check .`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
cd backend
git add -A
git commit -m "feat(backend): versioned REST API, app factory, lifespan, websocket endpoint"
```

---

### Task 8: End-to-end runtime verification

**Files:**
- Create: `backend/tests/websocket/test_endpoint.py`

**Interfaces:**
- Consumes: full `app.main:app` from Task 7.
- Produces: proof the server boots, serves REST, and supports a live WebSocket round-trip.

- [ ] **Step 1: Write WebSocket endpoint integration test**

`backend/tests/websocket/test_endpoint.py`:
```python
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
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            hello = ws.receive_json()
            assert hello["type"] == "hello"
            ws.send_json({"type": "ping", "ts": 42})
            pong = ws.receive_json()
            assert pong["type"] == "pong"
            assert pong["payload"]["ts"] == 42
```

- [ ] **Step 2: Run full suite**

Run: `cd backend && uv run pytest -q`
Expected: all pass, including the WS endpoint test.

- [ ] **Step 3: Boot the server**

Run: `cd backend && uv run uvicorn app.main:app --port 8000 &`
Expected: logs `startup_complete`, server listening on `http://127.0.0.1:8000`.

- [ ] **Step 4: Probe REST + WebSocket**

Run: `curl -s http://127.0.0.1:8000/api/v1/health/live` → `{"status":"ok"}`
Run: `curl -s -X POST http://127.0.0.1:8000/api/v1/chat/messages -H 'content-type: application/json' -d '{"message":"Hello"}'` → mock reply JSON with `conversation_id`.
Run a WS probe:
```bash
uv run python - <<'PY'
import asyncio, json
import websockets
async def main():
    async with websockets.connect("ws://127.0.0.1:8000/ws") as ws:
        print("hello:", await ws.recv())
        await ws.send(json.dumps({"type": "ping", "ts": 7}))
        print("pong:", await ws.recv())
asyncio.run(main())
PY
```
Expected: prints `hello:` envelope and `pong:` envelope.

- [ ] **Step 5: Shut the server down**

Run: kill the uvicorn process; verify logs show `scheduler_stopped` and `shutdown_complete`.

- [ ] **Step 6: Commit**

```bash
cd backend
git add -A
git commit -m "test(backend): websocket endpoint integration test"
```

---

### Task 9: Documentation

**Files:**
- Create: `backend/README.md`, `backend/docs/ARCHITECTURE.md`, `backend/docs/POSTGRESQL.md`, `backend/docs/ROADMAP.md`

- [ ] **Step 1: Write `README.md`**

Sections: overview, architecture summary, directory map (with one-line purpose per folder), prerequisites (Python ≥3.12, uv), setup (`uv sync`), `.env` configuration table, run (`uv run uvicorn app.main:app --reload`), migrations (`uv run alembic upgrade head`), tests (`uv run pytest`), lint (`uv run ruff check .`), API reference table (all endpoints), WebSocket protocol, verification checklist.

- [ ] **Step 2: Write `docs/ARCHITECTURE.md`**

Sections: layering rules (dependency direction), module responsibilities, request lifecycle, Mermaid dependency graph, WS message flow, scheduler flow, error envelope contract, Postgres migration note.

Mermaid graph to include (concrete content):
```mermaid
graph TD
    Client -->|REST| Router[api/v1 routers]
    Client -->|WebSocket /ws| WSM[ConnectionManager]
    Router --> Service[services]
    WSM --> Manager
    Router --> Dep[DI: get_db_session]
    Dep --> Factory[session_factory]
    Service --> Repo[repositories]
    Repo --> Models[models]
    Repo --> Session[session]
    Scheduler --> Service
    Service --> Base[Base.metadata]
    Middleware --> Router
    Exceptions --> Client
```

- [ ] **Step 3: Write `docs/POSTGRESQL.md`**

Steps: install `asyncpg`; set `DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/jarvis`; run `alembic upgrade head`; note JSON/UUID/String(36) choices are already portable; optional `pool_size` tuning.

- [ ] **Step 4: Write `docs/ROADMAP.md`**

Future sections: real AI chat (OpenAI/Anthropic), streaming tokens over WS (`stream.token`/`stream.end`), vector memory (embedding column already present; add pgvector/sqlite-vec), auth (single-user token), tool registry (`app/tools/`), voice STT/TTS, notifications push, Dockerfile + compose, CI (ruff + pytest + mypy).

- [ ] **Step 5: Verify nothing else broke**

Run: `cd backend && uv run pytest -q` → all green. `uv run ruff check .` → clean.

- [ ] **Step 6: Commit**

```bash
cd backend
git add -A
git commit -m "docs(backend): README, architecture, postgres migration, roadmap"
```

---

## Self-Review Notes

- **Spec coverage:** every spec folder is created (`api, core, config, database, models, schemas, repositories, services, tools, memory, websocket, scheduler, utils, middleware, dependencies, exceptions, tests`). `tools/` (ToolRegistry) and `memory/` (MemoryManager) are real, tested modules. All 8 models, config, health/system/chat/memory/notifications/settings/projects/reminders endpoints, WebSocket infra, structured logging, background scheduler, middleware, lifespan, tests and docs are present.
- **Type consistency:** `create_app(settings=None)` used identically in main.py and tests; `get_db_session` reads `request.app.state.session_factory`; `ConnectionManager` exposed as `app.state.websocket_manager`; `ListResponse[T]` used by all list endpoints; service constructors match Task 4 signatures; memory router imports `MemoryManager` from `app.memory.manager`.
- **Task 6 is self-contained** (inline `Settings` construction) and the shared `tests/conftest.py` fixtures arrive in Task 7, which owns the remaining API tests that depend on them.
