"""Concrete HTTP error types used by services and endpoints."""
from app.exceptions.base import JARVISError


class NotFoundError(JARVISError):
    """Raised when a requested resource does not exist (404)."""

    status_code = 404
    code = "not_found"


class ConflictError(JARVISError):
    """Raised when a change conflicts with existing state (409)."""

    status_code = 409
    code = "conflict"


class ValidationAppError(JARVISError):
    """Raised for business-rule validation failures (422)."""

    status_code = 422
    code = "validation_error"


class UnauthorizedError(JARVISError):
    """Raised when credentials are missing/invalid (401)."""

    status_code = 401
    code = "unauthorized"


class ForbiddenError(JARVISError):
    """Raised when the caller lacks permission (403)."""

    status_code = 403
    code = "forbidden"


class ServiceUnavailableError(JARVISError):
    """Raised when a dependency is unreachable (503)."""

    status_code = 503
    code = "service_unavailable"
