"""Chat endpoints — deterministic mock responses, streaming-ready."""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.envelope import ok
from app.config.settings import Settings
from app.core.chat_stream_manager import ChatStreamManager
from app.dependencies.database import get_db_session
from app.dependencies.settings import get_settings
from app.repositories.implementations import ConversationRepository, MessageRepository
from app.schemas.chat import ChatMessageRequest, ChatRequest
from app.services.chat import ChatService

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/messages")
async def chat_message(
    payload: ChatMessageRequest,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Persist a message turn and return an AI (or fallback) assistant reply."""
    ai_manager = getattr(request.app.state, "ai_manager", None)
    conversation_factory = getattr(request.app.state, "conversation_factory", None)
    service = ChatService(
        ConversationRepository(session),
        MessageRepository(session),
        settings,
        ai_manager=ai_manager,
        conversation_factory=conversation_factory,
    )
    return ok(await service.respond(payload))


@router.post("")
async def start_chat(
    payload: ChatRequest,
    request: Request,
) -> dict:
    """Start a streaming chat over WebSocket; returns an acknowledgment."""
    manager: ChatStreamManager = request.app.state.chat_manager
    accepted = await manager.start(payload)
    return ok(accepted)