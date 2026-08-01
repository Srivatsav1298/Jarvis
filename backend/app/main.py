"""Application bootstrap factory (minimal for middleware tests)."""
from fastapi import FastAPI

from app.config.settings import Settings, get_settings
from app.middleware.cors import add_cors
from app.middleware.request_logging import RequestLoggingMiddleware


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the FastAPI application with middleware configured."""
    settings = settings or get_settings()
    app = FastAPI(title=settings.app_name, version=settings.app_version, debug=settings.debug)
    add_cors(app, settings.cors_origins)
    app.add_middleware(RequestLoggingMiddleware)

    @app.get("/")
    async def root() -> dict:
        return {"name": settings.app_name, "status": "ok"}

    return app


app = create_app()
