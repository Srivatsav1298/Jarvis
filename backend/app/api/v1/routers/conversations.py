"""Conversation CRUD endpoints (enveloped)."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.envelope import ok
from app.dependencies.database import get_db_session
from app.exceptions import NotFoundError
from app.repositories.implementations import (
    ConversationRepository,
    MessageRepository,
)
from app.schemas.chat import (
    ConversationCreate,
    ConversationDetail,
    ConversationRead,
    ConversationUpdate,
)
from app.schemas.common import ListResponse
from app.services.conversations import ConversationService

router = APIRouter(prefix="/conversations", tags=["conversations"])


def _service(session: AsyncSession) -> ConversationService:
    return ConversationService(
        ConversationRepository(session), MessageRepository(session)
    )


@router.get("")
async def list_conversations(
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Return a page of conversations, most-recently-updated first."""
    service = _service(session)
    items, total = await service.list_conversations(limit=limit, offset=offset)
    reads = [ConversationRead.model_validate(i) for i in items]
    return ok(ListResponse(items=reads, total=total))


@router.post("", status_code=201)
async def create_conversation(
    payload: ConversationCreate,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Create a new conversation."""
    service = _service(session)
    result = await service.create_conversation(title=payload.title)
    return ok(ConversationRead.model_validate(result))


@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Return a conversation with its messages."""
    service = _service(session)
    result = await service.get_conversation(conversation_id)
    if result is None:
        raise NotFoundError("Conversation not found")
    return ok(ConversationDetail.model_validate(result))


@router.patch("/{conversation_id}")
async def update_conversation(
    conversation_id: str,
    payload: ConversationUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Partially update a conversation."""
    service = _service(session)
    result = await service.update_conversation(
        conversation_id, payload.model_dump(exclude_unset=True)
    )
    if result is None:
        raise NotFoundError("Conversation not found")
    return ok(ConversationRead.model_validate(result))


@router.delete("/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a conversation and its messages."""
    service = _service(session)
    if not await service.delete_conversation(conversation_id):
        raise NotFoundError("Conversation not found")