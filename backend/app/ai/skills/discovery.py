"""Skill auto-discovery — scans a directory for skill definition files.

Supports two formats, chosen by extension:
  * `.md`    — Markdown with a YAML frontmatter block (`name`, `description`,
               `keywords`, `requires_tools`).
  * `.yaml`  — standalone YAML with the same fields.

Discovery is idempotent and never raises: unreadable or malformed files are
skipped with a warning so a single bad skill cannot break startup.
"""
import logging
from pathlib import Path

import yaml

from app.ai.skills.registry import SkillRegistry
from app.ai.skills.skill import Skill

logger = logging.getLogger(__name__)


class SkillDiscoveryError(Exception):
    """Raised when a skill definition is structurally invalid."""


def discover_skills(directory: str | Path) -> list[Skill]:
    """Scan `directory` and return every discoverable skill."""
    root = Path(directory)
    if not root.exists():
        logger.info("skills_dir_missing", extra={"extra_fields": {"dir": str(root)}})
        return []

    skills: list[Skill] = []
    for path in sorted(root.iterdir()):
        if path.is_dir() or path.name.startswith("."):
            continue
        try:
            definition = _parse(path)
        except (SkillDiscoveryError, OSError, yaml.YAMLError) as exc:
            logger.warning(
                "skill_skipped",
                extra={"extra_fields": {"path": str(path), "reason": str(exc)}},
            )
            continue
        if definition is None:
            continue
        skills.append(_to_skill(definition, source=str(path)))
    return skills


def register_discovered(registry: SkillRegistry, directory: str | Path) -> int:
    """Discover skills from `directory` and register them; returns count."""
    discovered = discover_skills(directory)
    for skill in discovered:
        registry.register(skill)
    return len(discovered)


def _parse(path: Path) -> dict | None:
    if path.suffix == ".md":
        return _parse_markdown(path)
    if path.suffix in {".yaml", ".yml"}:
        return _parse_yaml(path)
    return None


def _parse_markdown(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    stripped = text.lstrip()
    if not stripped.startswith("---"):
        raise SkillDiscoveryError("missing YAML frontmatter")
    end = stripped.find("\n---", 4)
    if end == -1:
        raise SkillDiscoveryError("unterminated YAML frontmatter")
    raw = stripped[4:end]
    data = yaml.safe_load(raw) or {}
    if not isinstance(data, dict):
        raise SkillDiscoveryError("frontmatter must be a mapping")
    return data


def _parse_yaml(path: Path) -> dict:
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        raise SkillDiscoveryError("skill definition must be a mapping")
    return data


def _to_skill(data: dict, *, source: str) -> Skill:
    name = (data.get("name") or "").strip()
    if not name:
        raise SkillDiscoveryError("skill missing 'name'")
    _core = {"name", "description", "keywords", "requires_tools"}
    return Skill(
        name=name,
        description=(data.get("description") or "").strip(),
        keywords=[str(k) for k in (data.get("keywords") or [])],
        requires_tools=[str(t) for t in (data.get("requires_tools") or [])],
        source=source,
        metadata={k: v for k, v in data.items() if k not in _core},
    )
