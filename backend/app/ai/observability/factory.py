"""Observability factory — builds AIMetrics + Tracer from settings."""
from app.ai.observability.metrics import AIMetrics
from app.ai.observability.tracing import Tracer
from app.config.settings import Settings


def build_observability(settings: Settings) -> dict:
    """Return {"metrics": AIMetrics, "tracer": Tracer} for the app."""
    return {
        "metrics": AIMetrics(),
        "tracer": Tracer(
            enabled=settings.debug,
            emit_logs=settings.otel_traces_enabled,
        ),
    }
