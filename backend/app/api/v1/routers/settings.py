"""Application settings endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.envelope import ok
from app.dependencies.database import get_db_session
from app.repositories.implementations import SettingsRepository
from app.schemas.settings import SettingsRead, SettingsUpdate
from app.services.settings import SettingsService

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("")
async def get_settings(session: AsyncSession = Depends(get_db_session)) -> dict:
    """Return the persisted application settings."""
    service = SettingsService(SettingsRepository(session))
    return ok(SettingsRead(data=await service.get_all()))


@router.patch("")
async def patch_settings(
    payload: SettingsUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Merge a partial update into the persisted settings."""
    service = SettingsService(SettingsRepository(session))
    return ok(SettingsRead(data=await service.merge(payload.data)))