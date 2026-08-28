"""Health endpoints: liveness and readiness probes."""
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.envelope import ok
from app.dependencies.database import get_db_session
from app.exceptions import ServiceUnavailableError

router = APIRouter(tags=["health"])


@router.get("/health/live")
async def health_live() -> dict:
    """Liveness probe — returns 200 while the process is up."""
    return ok({"status": "ok"})


@router.get("/health/ready")
async def health_ready(
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Readiness probe — verifies the database is reachable."""
    try:
        await session.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001
        raise ServiceUnavailableError("Database not reachable") from exc
    return ok({"status": "ready"})