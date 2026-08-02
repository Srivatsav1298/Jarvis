# PostgreSQL Migration

The backend runs on SQLite by default (`sqlite+aiosqlite:///./data/jarvis.db`)
but is designed to be switched to PostgreSQL with a single configuration change.
This guide walks through the swap.

## 1. Install `asyncpg`

Add the async PostgreSQL driver to the project dependencies:

```bash
uv add 'asyncpg>=0.29,<1.0'
```

`asyncpg` is the async driver used by SQLAlchemy's `postgresql+asyncpg://` DSN.

## 2. Point the DSN at PostgreSQL

Set `DATABASE_URL` in `.env` (or the environment):

```dotenv
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/jarvis
```

Create the database first if it does not exist:

```bash
createdb jarvis
```

## 3. Run the migrations

Alembic reads `Settings.database_url`, so no other changes are needed:

```bash
uv run alembic upgrade head
```

The same initial revision (`cbe2c4024f3d`) applies to PostgreSQL unchanged — the
migration and model DDL use portable column types.

## 4. Portability notes

The schema was chosen to be DB-agnostic, so no model edits are required:

- **IDs** are `String(36)` UUID strings (`app/utils/ids.py`), not DB-native UUIDs.
- **JSON** fields (`MemoryEntry.data`, `MemoryEntry.embedding`, `SettingsRecord.data`)
  use SQLAlchemy `JSON`, which maps to `JSON` on Postgres.
- **Timestamps** (`TimestampMixin`) are timezone-aware `DateTime(timezone=True)`.
- **FK constraints** use standard `ondelete` rules; SQLite's `PRAGMA foreign_keys=ON`
  is enabled per connection in `app/database/engine.py`, while Postgres enforces
  FKs natively.

## 5. Optional: pool tuning

The engine is created in `app/database/engine.py` via `create_async_engine`.
For a Postgres deployment you may want to tune the connection pool, e.g.:

```python
engine = create_async_engine(
    settings.database_url,
    echo=settings.database_echo,
    future=True,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)
```

`pool_pre_ping=True` helps avoid stale connections after idle timeouts.

## Verification

```bash
uv run alembic current        # shows cbe2c4024f3d (head)
uv run pytest -q              # suite stays green against Postgres
```
