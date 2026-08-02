"""Application configuration loaded from environment variables and .env."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Single source of truth for runtime configuration (env + .env)."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "IronmanJARVIS"
    app_version: str = "0.1.0"
    environment: str = "development"
    debug: bool = False
    host: str = "127.0.0.1"
    port: int = 8000
    api_prefix: str = "/api/v1"

    # Database
    database_url: str = "sqlite+aiosqlite:///./data/jarvis.db"
    database_echo: bool = False

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:4173"]

    # Logging
    log_level: str = "INFO"
    log_format: str = "json"

    # AI provider (placeholders — no AI logic yet)
    ai_provider: str = "openai"
    ai_model: str = "gpt-4o-mini"
    ai_api_key: str = ""

    # Voice (placeholders for future STT/TTS)
    voice_enabled: bool = False
    voice_stt_engine: str = ""
    voice_tts_engine: str = ""

    @property
    def is_production(self) -> bool:
        """True when running in the production environment."""
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    """Return the cached application settings instance."""
    return Settings()
