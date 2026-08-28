"""System endpoints: runtime metadata and live metrics."""
import time

from fastapi import APIRouter, Request

from app.api.envelope import ok
from app.config.settings import Settings
from app.providers.metrics import get_metrics_provider
from app.schemas.system import AssistantStatus
from app.services.system import SystemService

router = APIRouter(tags=["system"])


@router.get("/system/info")
async def system_info(request: Request) -> dict:
    """Return name, version and runtime environment metadata."""
    settings: Settings = request.app.state.settings
    return ok(SystemService(settings).info())


@router.get("/system/metrics")
async def system_metrics(request: Request) -> dict:
    """Return a snapshot of live system metrics."""
    provider = get_metrics_provider()
    started = time.perf_counter()
    snapshot = await provider.snapshot()
    snapshot.api_latency_ms = (time.perf_counter() - started) * 1000
    return ok(snapshot)


@router.get("/system/assistant", response_model=dict)
async def assistant_status(request: Request) -> dict:
    """Return the active provider, tools, and voice capability state."""
    settings: Settings = request.app.state.settings
    manager = getattr(request.app.state, "ai_manager", None)
    provider = manager.name if manager is not None else settings.ai_provider
    model = manager.model if manager is not None else settings.ai_model
    return ok(
        AssistantStatus(
            provider=provider,
            model=model,
            provider_healthy=None,
            degraded=provider != settings.ai_provider,
            live_tools_enabled=settings.ai_enable_live_tools,
            voice_enabled=settings.voice_enabled,
            voice_engine=settings.voice_tts_engine,
            voice_profile=settings.voice_tts_voice,
        ).model_dump()
    )
