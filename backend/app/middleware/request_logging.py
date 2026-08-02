"""Middleware that logs every request with method, path, status and duration."""
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.utils.logging import get_logger

logger = get_logger("http")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Records request metadata and adds a process-time response header."""

    async def dispatch(self, request: Request, call_next):
        started = time.perf_counter()
        response = await call_next(request)
        duration_ms = int((time.perf_counter() - started) * 1000)
        logger.info(
            "request_completed",
            extra={
                "extra_fields": {
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "duration_ms": duration_ms,
                }
            },
        )
        response.headers["X-Process-Time-Ms"] = str(duration_ms)
        return response
