"""Async session factory creation."""
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
)


def build_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """Return a sessionmaker bound to the given engine."""
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
