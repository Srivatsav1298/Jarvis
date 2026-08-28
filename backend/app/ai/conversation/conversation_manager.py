"""ConversationManager — assembles model-ready context for each user turn.

Coordination hub: loads persisted history → gathers injected context →
builds the system prompt → trims to the token budget → hands a ready message
list to the caller (who owns the provider call).
"""
from collections.abc import Sequence
from dataclasses import dataclass, field

from app.ai.conversation.context_builder import ContextBuilder, ConversationContext
from app.ai.conversation.prompt_builder import PromptBuilder
from app.ai.conversation.session_manager import SessionManager
from app.ai.conversation.token_budget import TokenBudgetManager
from app.ai.providers.base import ChatMessage
from app.config.settings import Settings


@dataclass
class PreparedTurn:
    """A model-ready turn plus the context it was grounded on."""

    messages: list[ChatMessage]
    estimated_tokens: int
    context: ConversationContext = field(default_factory=ConversationContext)
    history_trimmed: int = 0


class ConversationManager:
    """The single entry point for assembling conversation context."""

    def __init__(
        self,
        settings: Settings,
        context_builder: ContextBuilder,
        *,
        message_repository=None,
        token_budget: TokenBudgetManager | None = None,
        prompt_builder: PromptBuilder | None = None,
        session_manager: SessionManager | None = None,
    ) -> None:
        self.settings = settings
        self.context_builder = context_builder
        self.message_repository = message_repository
        self.token_budget = token_budget or TokenBudgetManager(
            settings.conversation_token_budget
        )
        self.prompt_builder = prompt_builder or PromptBuilder(
            settings.conversation_system_prompt
        )
        self.session_manager = session_manager or SessionManager()

    async def prepare(
        self,
        *,
        user_message: str,
        conversation_id: str,
        memory_query: str | None = None,
        tools: list[str] | None = None,
    ) -> PreparedTurn:
        """Build the full message list for one user turn."""
        session = self.session_manager.get_or_create(conversation_id)
        session.touch()

        context = await self.context_builder.build(
            memory_query=memory_query or user_message, tools=tools
        )

        system = self.prompt_builder.build_system_message(
            memories=context.memories,
            projects=context.projects,
            preferences=context.preferences,
            now=context.now,
            tools=context.tools,
        )

        history: list[ChatMessage] = []
        if self.message_repository is not None:
            history = await self._load_history(conversation_id)

        # Idempotent: skip when the user turn was already persisted.
        last = history[-1] if history else None
        if not (last and last.role == "user" and last.content == user_message):
            history.append(ChatMessage(role="user", content=user_message))

        combined = [system] + history
        budget = self.token_budget.trim(combined)

        return PreparedTurn(
            messages=budget.messages,
            estimated_tokens=budget.estimated_tokens,
            context=context,
            history_trimmed=budget.trimmed,
        )

    async def _load_history(self, conversation_id: str) -> list[ChatMessage]:
        """Load recent messages, excluding the just-written user turn."""
        rows: Sequence = await self.message_repository.for_conversation(conversation_id)
        limit = self.settings.conversation_max_messages
        return [
            ChatMessage(role=row.role, content=row.content)
            for row in rows[-limit:]
        ]

    def finish_turn(self, conversation_id: str) -> None:
        """Bookkeeping after a turn completes (touch + prune stale sessions)."""
        self.session_manager.touch(conversation_id)
        self.session_manager.sweep()