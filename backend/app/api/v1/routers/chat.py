"""Chat endpoints — deterministic mock responses, streaming-ready."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import Settings
from app.dependencies.database import get_db_session
from app.dependencies.settings import get_settings
from app.repositories.implementations import ConversationRepository, MessageRepository
from app.schemas.chat import ChatMessageRequest, ChatResponse
from app.services.chat import ChatService

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/messages", response_model=ChatResponse)
async def chat_message(
    payload: ChatMessageRequest,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ChatResponse:
    """Persist a message turn and return a mock assistant reply."""
    service = ChatService(
        ConversationRepository(session), MessageRepository(session), settings
    )
    return await service.respond(payload)
