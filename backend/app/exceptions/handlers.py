"""FastAPI exception handlers mapping domain errors to a uniform envelope."""
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.exceptions.base import JARVISError


def _error_body(status: int, code: str, message: str, detail: Any = None) -> dict[str, Any]:
    """Build the standardized error response body."""
    return {
        "type": "about:blank",
        "title": message,
        "status": status,
        "code": code,
        "detail": detail,
    }


def register_exception_handlers(app: FastAPI) -> None:
    """Attach handlers for domain errors and request-validation errors."""

    @app.exception_handler(JARVISError)
    async def jarvis_error_handler(_: Request, exc: JARVISError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(exc.status_code, exc.code, exc.message, exc.detail),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        _: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_error_body(
                422, "validation_error", "Request validation failed", exc.errors()
            ),
        )
