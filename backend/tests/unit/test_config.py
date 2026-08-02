"""Tests for application settings loading and defaults."""
from app.config.settings import Settings


def test_defaults_are_sane() -> None:
    settings = Settings(_env_file=None)
    assert settings.app_name == "IronmanJARVIS"
    assert settings.environment == "development"
    assert settings.database_url.startswith("sqlite+aiosqlite")
    assert not settings.is_production


def test_env_overrides_defaults(monkeypatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("AI_MODEL", "gpt-5")
    settings = Settings(_env_file=None)
    assert settings.environment == "production"
    assert settings.ai_model == "gpt-5"
    assert settings.is_production
