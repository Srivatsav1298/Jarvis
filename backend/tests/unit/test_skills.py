"""Tests for the skills layer (Task 10) — registry + auto-discovery."""
from pathlib import Path

from app.ai.skills import Skill, SkillRegistry, discover_skills, register_discovered


class TestSkillRegistry:
    def test_register_and_get(self):
        registry = SkillRegistry()
        skill = registry.register_builtin("summarize", description="Summarizes text")
        assert registry.get("summarize") is skill

    def test_match_by_keyword(self):
        registry = SkillRegistry()
        registry.register_builtin("weather", keywords=["weather", "forecast"])
        registry.register_builtin("timer", keywords=["timer", "set timer"])
        matches = registry.match("what is the weather today?")
        assert [s.name for s in matches] == ["weather"]

    def test_disabled_skills_do_not_match(self):
        registry = SkillRegistry()
        registry.register_builtin("timer", keywords=["timer"])
        assert registry.set_enabled("timer", False) is True
        assert registry.match("start a timer") == []
        assert registry.get("timer").enabled is False

    def test_remove_returns_bool(self):
        registry = SkillRegistry()
        registry.register_builtin("tmp")
        assert registry.remove("tmp") is True
        assert registry.remove("tmp") is False

    def test_snapshot_shape(self):
        registry = SkillRegistry()
        registry.register_builtin("a", description="desc", keywords=["x"])
        data = registry.snapshot()
        assert data[0]["name"] == "a"
        assert data[0]["keywords"] == ["x"]
        assert data[0]["source"] == "builtin"


class TestDiscovery:
    def test_discovers_markdown_skills(self, tmp_path: Path):
        (tmp_path / "focus.md").write_text(
            "---\nname: focus\n"
            "description: Enter focus mode\n"
            "keywords: [focus, concentrate]\n"
            "requires_tools: [reminders]\n"
            "---\nInstructions for focus mode.\n",
            encoding="utf-8",
        )
        (tmp_path / "notes.md").write_text(
            "---\nname: notes\ndescription: Take notes\nkeywords: [note]\n---\n",
            encoding="utf-8",
        )
        skills = discover_skills(tmp_path)
        assert len(skills) == 2
        focus = next(s for s in skills if s.name == "focus")
        assert focus.keywords == ["focus", "concentrate"]
        assert focus.requires_tools == ["reminders"]

    def test_discovers_yaml_skills(self, tmp_path: Path):
        (tmp_path / "summary.yaml").write_text(
            "name: summarize\n"
            "description: Summarize long text\n"
            "keywords:\n  - summarize\n  - tl;dr\n",
            encoding="utf-8",
        )
        skills = discover_skills(tmp_path)
        assert len(skills) == 1
        assert skills[0].name == "summarize"
        assert "summarize" in skills[0].keywords

    def test_missing_directory_is_empty(self, tmp_path: Path):
        assert discover_skills(tmp_path / "does-not-exist") == []

    def test_malformed_skill_is_skipped(self, tmp_path: Path):
        (tmp_path / "bad.md").write_text("no frontmatter here\n", encoding="utf-8")
        (tmp_path / "good.md").write_text(
            "---\nname: good\ndescription: ok\n---\n", encoding="utf-8"
        )
        skills = discover_skills(tmp_path)
        assert [s.name for s in skills] == ["good"]

    def test_register_discovered_returns_count(self, tmp_path: Path):
        (tmp_path / "a.md").write_text("---\nname: a\ndescription: one\n---\n", encoding="utf-8")
        (tmp_path / "b.md").write_text("---\nname: b\ndescription: two\n---\n", encoding="utf-8")
        registry = SkillRegistry()
        count = register_discovered(registry, tmp_path)
        assert count == 2
        assert registry.get("a") is not None
        assert registry.get("b") is not None


class TestSkillModel:
    def test_describe_shape(self):
        skill = Skill(name="x", description="d", keywords=["k"], source="file.md")
        data = skill.describe()
        assert data == {
            "name": "x",
            "description": "d",
            "keywords": ["k"],
            "requires_tools": [],
            "source": "file.md",
            "enabled": True,
        }
