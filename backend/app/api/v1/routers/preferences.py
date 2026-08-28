"""Preference endpoints — GET/PUT the key/value map."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.envelope import ok
from app.dependencies.database import get_db_session
from app.repositories.implementations import PreferenceRepository
from app.schemas.preferences import PreferencesRead, PreferencesUpdate
from app.services.preferences import PreferencesService

router = APIRouter(prefix="/preferences", tags=["preferences"])


@router.get("")
async def get_preferences(
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Return all preferences as a key/value map."""
    service = PreferencesService(PreferenceRepository(session))
    return ok(PreferencesRead(data=await service.get_all()))


@router.put("")
async def update_preferences(
    payload: PreferencesUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Merge provided preferences into the stored map."""
    service = PreferencesService(PreferenceRepository(session))
    return ok(PreferencesRead(data=await service.merge(payload.data)))