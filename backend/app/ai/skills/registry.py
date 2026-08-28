"""SkillRegistry — in-memory registry of assistant skills."""
import logging
from typing import Any

from app.ai.skills.skill import Skill

logger = logging.getLogger(__name__)


class SkillRegistry:
    """Stores skills by name and supports listing / lookup / enable-disable."""

    def __init__(self) -> None:
        self._skills: dict[str, Skill] = {}

    def register(self, skill: Skill) -> Skill:
        """Register (or replace) a skill by name."""
        self._skills[skill.name] = skill
        return skill

    def register_builtin(
        self,
        name: str,
        *,
        description: str = "",
        keywords: list[str] | None = None,
        requires_tools: list[str] | None = None,
        impl=None,
    ) -> Skill:
        """Convenience builder for programmatically-defined skills."""
        return self.register(
            Skill(
                name=name,
                description=description,
                keywords=keywords or [],
                requires_tools=requires_tools or [],
                source="builtin",
                impl=impl,
            )
        )

    def get(self, name: str) -> Skill | None:
        """Fetch a skill by name."""
        return self._skills.get(name)

    def remove(self, name: str) -> bool:
        """Remove a skill; returns True if it existed."""
        return self._skills.pop(name, None) is not None

    def list(self, *, enabled_only: bool = True) -> list[Skill]:
        """List skills, optionally filtering to enabled ones."""
        skills = [s for s in self._skills.values() if s.enabled or not enabled_only]
        return sorted(skills, key=lambda s: s.name)

    def match(self, text: str) -> list[Skill]:
        """Return enabled skills whose keywords match `text`, ranked."""
        matched = [s for s in self.list(enabled_only=True) if s.matches(text)]
        return sorted(
            matched,
            key=lambda s: -sum(1 for kw in s.keywords if kw in (text or "").lower()),
        )

    def set_enabled(self, name: str, enabled: bool) -> bool:
        """Enable or disable a skill; returns False if it does not exist."""
        skill = self._skills.get(name)
        if skill is None:
            return False
        skill.enabled = enabled
        return True

    def snapshot(self) -> list[dict[str, Any]]:
        """Serialize all skills for API exposure."""
        return [s.describe() for s in self.list(enabled_only=False)]
