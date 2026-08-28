"""Provider factory — builds the configured adapter, never a hardcoded one.

`build_provider(settings)` returns the provider named by `settings.ai_provider`.
Provider names: ollama | openai | openrouter | lmstudio | gemini | fallback.
`resolve_provider(settings)` runs a health probe and, when the configured
provider is unreachable, returns the configured fallback instead (auto-routing).
"""
from app.ai.providers.base import AIProvider
from app.ai.providers.fallback import FallbackProvider
from app.ai.providers.gemini import gemini_adapter
from app.ai.providers.ollama import ollama_adapter
from app.ai.providers.openai_compat import openai_adapter
from app.config.settings import Settings

PROVIDER_NAMES = ("ollama", "openai", "openrouter", "lmstudio", "gemini", "fallback")


def build_provider(settings: Settings) -> AIProvider:
    """Construct the provider named by `settings.ai_provider` (no probe)."""
    name = settings.ai_provider
    if name == "fallback":
        return FallbackProvider(model="deterministic-fallback")
    if name == "ollama":
        return ollama_adapter(settings)
    if name == "gemini":
        return gemini_adapter(settings)
    if name in ("openai", "openrouter", "lmstudio"):
        base = {
            "openai": settings.ai_openai_base_url,
            "openrouter": settings.ai_openrouter_base_url,
            "lmstudio": settings.ai_lmstudio_base_url,
        }[name]
        provider = openai_adapter(settings)
        provider.base_url = base.rstrip("/")
        return provider
    raise ValueError(
        f"ai_provider={name!r} is invalid. Choose one of {', '.join(PROVIDER_NAMES)}"
    )


async def resolve_provider(settings: Settings) -> AIProvider:
    """Return the configured provider, falling back when it is unhealthy.

    Auto-routing policy:
      - configured provider healthy  → use it
      - configured provider down     → use `settings.ai_fallback_provider`
      - fallback also unavailable    → deterministic responder (always on)
    """
    if settings.ai_provider not in PROVIDER_NAMES:
        raise ValueError(
            f"ai_provider={settings.ai_provider!r} is invalid. "
            f"Choose one of {', '.join(PROVIDER_NAMES)}"
        )
    provider = build_provider(settings)
    if not settings.ai_auto_fallback:
        return provider

    try:
        health = await provider.health()
        if health.ok:
            return provider
    except Exception:  # noqa: BLE001
        pass

    target = settings.ai_fallback_provider
    if target not in PROVIDER_NAMES:
        target = "fallback"
    if target == settings.ai_provider:
        return provider
    return build_provider(settings.model_copy(update={"ai_provider": target}))