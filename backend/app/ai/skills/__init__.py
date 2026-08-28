"""Skills package — registry + filesystem auto-discovery."""
from app.ai.skills.discovery import discover_skills, register_discovered
from app.ai.skills.registry import SkillRegistry
from app.ai.skills.skill import Skill

__all__ = [
    "Skill",
    "SkillRegistry",
    "discover_skills",
    "register_discovered",
]
