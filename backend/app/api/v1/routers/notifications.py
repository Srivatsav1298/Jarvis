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
