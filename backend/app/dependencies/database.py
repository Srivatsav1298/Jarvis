"""DI: provide an async database session per request."""
from collections.abc import AsyncGenerator

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession


async def get_db_session(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """Yield a session created by the app's lifespan-built factory."""
    session_factory = request.app.state.session_factory
    async with session_factory() as session:
        yield session
