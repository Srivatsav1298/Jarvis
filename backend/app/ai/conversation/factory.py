"""Conversation factory — builds a ConversationManager bound to one session.

The engine needs repository-backed context and history, so a fresh manager is
built per DB session. A shared SessionManager can be injected to preserve
runtime state across turns of the same conversation.
"""
from app.ai.conversation.context_builder import ContextBuilder
from app.ai.conversation.conversation_manager import ConversationManager
from app.ai.conversation.session_manager import SessionManager
from app.ai.conversation.token_budget import TokenBudgetManager
from app.ai.memory.intelligence import MemoryIntelligence
from app.config.settings import Settings
from app.repositories.implementations import (
    MemoryRepository,
    MessageRepository,
    PreferenceRepository,
    ProjectRepository,
)


def build_conversation_manager(
    settings: Settings,
    session,
    *,
    session_manager: SessionManager | None = None,
) -> ConversationManager:
    """Return a ConversationManager wired to `session`'s repositories."""
    memory_repository = MemoryRepository(session)
    context_builder = ContextBuilder(
        memory_repository=memory_repository,
        project_repository=ProjectRepository(session),
        preference_repository=PreferenceRepository(session),
        memory_intelligence=MemoryIntelligence(memory_repository),
    )
    return ConversationManager(
        settings,
        context_builder,
        message_repository=MessageRepository(session),
        token_budget=TokenBudgetManager(settings.conversation_token_budget),
        session_manager=session_manager or SessionManager(),
    )
