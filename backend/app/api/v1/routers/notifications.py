"""Notification endpoints."""
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.envelope import ok
from app.dependencies.database import get_db_session
from app.exceptions import NotFoundError
from app.providers.notifier import WebSocketNotifier
from app.repositories.implementations import NotificationRepository
from app.schemas.common import ListResponse
from app.schemas.notification import NotificationCreate, NotificationRead
from app.services.notifications import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Return a page of notifications."""
    service = NotificationService(NotificationRepository(session))
    items, total = await service.list(limit=limit, offset=offset)
    reads = [NotificationRead.model_validate(i) for i in items]
    return ok(ListResponse(items=reads, total=total))


@router.post("", status_code=201)
async def create_notification(
    payload: NotificationCreate,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Create a notification and broadcast it over WebSocket."""
    service = NotificationService(NotificationRepository(session))
    notifier = WebSocketNotifier(request.app.state.websocket_manager)
    return ok(NotificationRead.model_validate(await service.publish(payload, notifier)))


@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    read: bool,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Mark a notification read/unread."""
    service = NotificationService(NotificationRepository(session))
    notification = await service.mark_read(notification_id, read)
    if notification is None:
        raise NotFoundError("Notification not found")
    return ok(NotificationRead.model_validate(notification))


@router.delete("/{notification_id}", status_code=204)
async def delete_notification(
    notification_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a notification."""
    service = NotificationService(NotificationRepository(session))
    if not await service.delete(notification_id):
        raise NotFoundError("Notification not found")