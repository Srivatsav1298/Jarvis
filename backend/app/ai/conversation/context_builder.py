"""ContextBuilder — assembles grounding context (memories, projects, prefs).

Pure data assembly over repositories. Emits plain strings the PromptBuilder can
inject. Designed so the Memory Intelligence layer (Task 4) plugs in here.
"""
from dataclasses import dataclass, field

from app.utils.time import utcnow


@dataclass
class ConversationContext:
    """Everything the prompt builder needs to ground a reply."""

    memories: list[str] = field(default_factory=list)
    projects: list[str] = field(default_factory=list)
    preferences: list[str] = field(default_factory=list)
    now: str = ""
    tools: list[str] = field(default_factory=list)


class ContextBuilder:
    """Gathers context from repositories and time utilities."""

    def __init__(
        self,
        memory_repository,
        project_repository,
        preference_repository,
        *,
        memory_limit: int = 8,
        project_limit: int = 5,
        memory_intelligence=None,
    ) -> None:
        self.memory_repository = memory_repository
        self.project_repository = project_repository
        self.preference_repository = preference_repository
        self.memory_limit = memory_limit
        self.project_limit = project_limit
        self.memory_intelligence = memory_intelligence

    async def build(
        self,
        *,
        memory_query: str | None = None,
        tools: list[str] | None = None,
    ) -> ConversationContext:
        """Assemble the current context in one async pass."""
        memories = await self._memories(memory_query)
        projects = await self._projects()
        preferences = await self._preferences()
        return ConversationContext(
            memories=memories,
            projects=projects,
            preferences=preferences,
            now=utcnow().strftime("%A, %d %B %Y %H:%M"),
            tools=tools or [],
        )

    async def _memories(self, query: str | None) -> list[str]:
        if self.memory_intelligence is not None and query:
            results = await self.memory_intelligence.recall(
                query, limit=self.memory_limit
            )
            return [
                r.entry.content
                for r in results
                if getattr(r.entry, "content", None)
            ]
        items = await self.memory_repository.list(
            limit=self.memory_limit, offset=0
        )
        return [m.content for m in items if getattr(m, "content", None)]

    async def _projects(self) -> list[str]:
        items = await self.project_repository.list(
            limit=self.project_limit, offset=0
        )
        result = []
        for p in items:
            label = getattr(p, "name", "")
            desc = getattr(p, "description", None)
            status = getattr(p, "status", "active")
            label = (
                f"{label} ({status}) — {desc}"
                if desc
                else f"{label} ({status})"
            )
            result.append(label)
        return result

    async def _preferences(self) -> list[str]:
        prefs = await self.preference_repository.all_as_dict()
        return [f"{key}: {value}" for key, value in prefs.items() if value]