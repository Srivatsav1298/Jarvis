"""Base class for every application-specific domain error."""
from typing import Any


class JARVISError(Exception):
    """Base exception; subclasses carry an HTTP status and machine code."""

    status_code = 500
    code = "internal_error"

    def __init__(
        self, message: str = "An unexpected error occurred.", *, detail: Any = None
    ) -> None:
        super().__init__(message)
        self.message = message
        self.detail = detail
