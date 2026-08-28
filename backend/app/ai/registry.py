"""AIManager — the runtime face of the AI layer.

Holds the resolved provider + capabilities, exposes health, and is what
services/endpoints depend on (via DI). Built once at app startup.
"""
from dataclasses import dataclass, field

from app.ai.providers.base import AIProvider, Capabilities, ProviderHealth


@dataclass
class AIInfo:
    """Snapshot describing the active AI provider."""

    provider: str
    model: str
    capabilities: Capabilities = field(default_factory=Capabilities)
    health: ProviderHealth | None = None
    auto_routed: bool = False


class AIManager:
    """Wraps a resolved provider and caches capability/health info."""

    def __init__(self, provider: AIProvider, configured_name: str) -> None:
        self.provider = provider
        self.configured_name = configured_name
        cap_fn = getattr(provider, "capabilities", None)
        self._capabilities = cap_fn() if callable(cap_fn) else Capabilities()
        self._info: AIInfo | None = None

    @property
    def name(self) -> str:
        """Provider name actually in use (may differ from configured on fallback)."""
        return getattr(self.provider, "name", self.configured_name)

    @property
    def model(self) -> str:
        return getattr(self.provider, "model", "unknown")

    def capabilities(self) -> Capabilities:
        return self._capabilities

    async def health(self) -> ProviderHealth:
        return await self.provider.health()

    def info(self) -> AIInfo:
        return AIInfo(
            provider=self.name,
            model=self.model,
            capabilities=self._capabilities,
            auto_routed=self.name != self.configured_name,
        )

    async def resolve(self) -> AIInfo:
        """Refresh health and return the latest snapshot."""
        self._info = AIInfo(
            provider=self.name,
            model=self.model,
            capabilities=self._capabilities,
            health=await self.provider.health(),
            auto_routed=self.name != self.configured_name,
        )
        return self._info