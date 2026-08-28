"""Reminder endpoints."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.envelope import ok
from app.dependencies.database import get_db_session
from app.exceptions import NotFoundError
from app.repositories.implementations import ReminderRepository
from app.schemas.common import ListResponse
from app.schemas.reminder import ReminderCreate, ReminderRead, ReminderUpdate
from app.services.reminders import ReminderService

router = APIRouter(prefix="/reminders", tags=["reminders"])


@router.get("")
async def list_reminders(
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Return a page of reminders."""
    service = ReminderService(ReminderRepository(session))
    items, total = await service.list(limit=limit, offset=offset)
    reads = [ReminderRead.model_validate(i) for i in items]
    return ok(ListResponse(items=reads, total=total))


@router.post("", status_code=201)
async def create_reminder(
    payload: ReminderCreate,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Create a reminder."""
    service = ReminderService(ReminderRepository(session))
    return ok(ReminderRead.model_validate(await service.create(payload)))


@router.patch("/{reminder_id}")
async def update_reminder(
    reminder_id: str,
    payload: ReminderUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Update a reminder."""
    service = ReminderService(ReminderRepository(session))
    reminder = await service.update(reminder_id, payload)
    if reminder is None:
        raise NotFoundError("Reminder not found")
    return ok(ReminderRead.model_validate(reminder))


@router.delete("/{reminder_id}", status_code=204)
async def delete_reminder(
    reminder_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a reminder."""
    service = ReminderService(ReminderRepository(session))
    if not await service.delete(reminder_id):
        raise NotFoundError("Reminder not found")