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
