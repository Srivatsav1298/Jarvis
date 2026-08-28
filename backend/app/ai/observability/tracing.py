"""Tracer — lightweight span-based tracing for AI operations.

Minimal, dependency-free spans (name, started, duration, attributes, error).
When OTel is enabled (`otel_traces_enabled`), the tracer logs spans through the
structured logger; otherwise it is a cheap in-memory no-op. This keeps tracing
behind a flag with zero mandatory dependencies.
"""
import logging
import time
import uuid
from typing import Any

logger = logging.getLogger(__name__)


class Span:
    """One traced operation."""

    __slots__ = ("trace_id", "name", "started_at", "duration_ms", "attributes", "error")

    def __init__(self, name: str, trace_id: str) -> None:
        self.trace_id = trace_id
        self.name = name
        self.started_at = time.monotonic()
        self.duration_ms: float | None = None
        self.attributes: dict[str, Any] = {}
        self.error: str | None = None

    def finish(self) -> "Span":
        """Record duration and emit the span via the logger."""
        self.duration_ms = round((time.monotonic() - self.started_at) * 1000.0, 3)
        return self

    def as_dict(self) -> dict[str, Any]:
        """Serialize the span for export/logging."""
        return {
            "trace_id": self.trace_id,
            "name": self.name,
            "duration_ms": self.duration_ms,
            "attributes": dict(self.attributes),
            "error": self.error,
        }


class Tracer:
    """Span factory with optional structured-log emission."""

    def __init__(self, *, enabled: bool = True, emit_logs: bool = False) -> None:
        self.enabled = enabled
        self.emit_logs = emit_logs
        self._spans: list[Span] = []

    def start(self, name: str) -> Span:
        """Begin a span (returns a no-op span when tracing is disabled)."""
        if not self.enabled:
            return _NoopSpan(name, "")
        span = Span(name, uuid.uuid4().hex[:16])
        self._spans.append(span)
        return span

    def span(self, name: str, **attributes: Any):
        """Context manager that starts/finishes a span with attributes."""
        return _SpanContext(self, name, attributes)

    def clear(self) -> None:
        """Drop all collected spans."""
        self._spans.clear()

    @property
    def spans(self) -> list[Span]:
        """Spans collected since the last clear."""
        return list(self._spans)

    def export(self) -> list[dict[str, Any]]:
        """Serialize spans for an external exporter (OTel bridge point)."""
        return [s.as_dict() for s in self._spans if s.duration_ms is not None]


class _NoopSpan(Span):
    def __init__(self, name: str, trace_id: str) -> None:
        self.name = name
        self.trace_id = trace_id
        self.started_at = time.monotonic()
        self.duration_ms = None
        self.attributes = {}
        self.error = None

    def finish(self) -> "Span":
        return self


class _SpanContext:
    def __init__(self, tracer: Tracer, name: str, attributes: dict[str, Any]) -> None:
        self._tracer = tracer
        self._name = name
        self._attributes = attributes
        self._span: Span | None = None

    def __enter__(self) -> Span:
        self._span = self._tracer.start(self._name)
        self._span.attributes.update(self._attributes)
        return self._span

    def __exit__(self, exc_type, exc, _tb) -> None:
        if self._span is None:
            return
        if exc is not None:
            self._span.error = f"{exc_type.__name__}: {exc}"
        self._span.finish()
        if self._tracer.emit_logs and self._tracer.enabled:
            logger.info(
                "span",
                extra={"extra_fields": self._span.as_dict()},
            )
