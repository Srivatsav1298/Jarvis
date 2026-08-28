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

    # AI provider (default: local-first Ollama; fallback provider auto-routes)
    ai_provider: str = "ollama"
    ai_model: str = "llama3.2"
    ai_api_key: str = ""

    # Provider connection details (selected via ai_provider only)
    ai_timeout_seconds: float = 120.0
    ai_ollama_base_url: str = "http://localhost:11434"
    ai_openai_base_url: str = "https://api.openai.com/v1"
    ai_openrouter_base_url: str = "https://openrouter.ai/api/v1"
    ai_lmstudio_base_url: str = "http://localhost:1234/v1"
    ai_gemini_base_url: str = "https://generativelanguage.googleapis.com"
    ai_extra_headers: dict[str, str] = {}

    # Auto-routing: when the configured provider is unhealthy, fall back to
    # another provider or the deterministic responder.
    ai_auto_fallback: bool = True
    ai_fallback_provider: str = "fallback"
    ai_enable_live_tools: bool = True
    ai_tool_call_limit: int = 4
    ai_tool_timeout_seconds: float = 12.0

    # Conversation engine
    ai_max_tokens: int = 2048
    ai_temperature: float = 0.7
    conversation_max_messages: int = 40
    conversation_token_budget: int = 6000
    conversation_system_prompt: str = (
        "You are Starc, a capable personal AI assistant. Answer directly, "
        "accurately, and helpfully. Use an available tool whenever the user "
        "needs current information, arithmetic, memory, weather, or an action. "
        "Never invent tool results, sources, or certainty. If a request is "
        "unsafe or impossible, explain why and offer a safe practical alternative. "
        "Match the user's tone and be concise unless detail is useful."
    )

    # Voice (provider-agnostic; selected via voice_* settings)
    voice_enabled: bool = False
    voice_stt_engine: str = "offline"   # offline | openai | whisper
    voice_tts_engine: str = "kokoro"    # kokoro | kokoro-api | offline | speech
    voice_tts_voice: str = "en-GB"      # default British English profile
    voice_tts_rate: float = 1.0
    voice_tts_pitch: float = 1.0
    voice_tts_volume: float = 1.0
    voice_wake_phrase: str = "Hey Starc"
    voice_vad_threshold: float = 0.15
    voice_profiles: dict[str, str] = {
        "british": "en-GB",
        "american": "en-US",
        "australian": "en-AU",
    }

    # Kokoro neural TTS (local, British voice by default)
    voice_kokoro_model_path: str = "voice_assets/kokoro-v1.0.onnx"
    voice_kokoro_voices_path: str = "voice_assets/voices-v1.0.bin"
    voice_kokoro_python_path: str = ".kokoro-venv/bin/python"
    voice_kokoro_voice: str = "bf_emma"     # British English female
    voice_kokoro_lang: str = "en-gb"
    voice_kokoro_speed: float = 1.0

    # Kokoro container TTS (OpenAI-compatible, self-hosted via Docker)
    kokoro_api_url: str = "http://localhost:8880/v1"
    kokoro_api_key: str = ""                # empty → "not-needed" default
    jarvis_voice_model: str = "af_heart"    # warm natural female

    # Skills / plugins
    skills_enabled: bool = True
    plugins_dir: str = "./plugins"
    plugins_enabled: bool = True

    # Observability
    otel_traces_enabled: bool = False

    @property
    def is_production(self) -> bool:
        """True when running in the production environment."""
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    """Return the cached application settings instance."""
    return Settings()
