"""Application bootstrap: factory, lifespan, middleware, routers, WebSocket."""
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket

from app.api.v1.router import api_router
from app.config.settings import Settings, get_settings
from app.core.constants import REMINDER_SWEEP_INTERVAL_SECONDS
from app.database.engine import build_engine, dispose_engine
from app.database.session import build_session_factory
from app.exceptions.handlers import register_exception_handlers
from app.middleware.cors import add_cors
from app.middleware.request_logging import RequestLoggingMiddleware
from app.repositories.implementations import ReminderRepository
from app.scheduler.scheduler import Scheduler
from app.services.reminders import ReminderService
from app.utils.logging import configure_logging, get_logger
from app.websocket.manager import ConnectionManager

logger = get_logger("app")


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build and configure the FastAPI application."""
    settings = settings or get_settings()
    configure_logging(settings.log_level, settings.log_format)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        """Start database, scheduler and WebSocket manager; tear down cleanly."""
        logger.info(
            "startup_begin",
            extra={"extra_fields": {"environment": settings.environment}},
        )
        engine = build_engine(settings)
        app.state.engine = engine
        app.state.session_factory = build_session_factory(engine)
        app.state.websocket_manager = ConnectionManager()

        scheduler = Scheduler()
        app.state.scheduler = scheduler

        async def reminder_sweep() -> None:
            """Periodically count due reminders and log them (scheduler demo)."""
            async with app.state.session_factory() as session:
                count = await ReminderService(
                    ReminderRepository(session)
                ).count_due()
                logger.info(
                    "reminder_sweep",
                    extra={"extra_fields": {"due": count}},
                )

        scheduler.register(
            "reminder_sweep", reminder_sweep, REMINDER_SWEEP_INTERVAL_SECONDS
        )
        await scheduler.start()

        logger.info(
            "startup_complete",
            extra={"extra_fields": {"environment": settings.environment}},
        )
        try:
            yield
        finally:
            await scheduler.stop()
            await dispose_engine(engine)
            logger.info(
                "shutdown_complete",
                extra={"extra_fields": {"environment": settings.environment}},
            )

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        debug=settings.debug,
        lifespan=lifespan,
    )
    app.state.settings = settings

    add_cors(app, settings.cors_origins)
    app.add_middleware(RequestLoggingMiddleware)
    register_exception_handlers(app)

    app.include_router(api_router)

    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket) -> None:
        """Handle one WebSocket client connection (hello/ping/broadcast)."""
        manager: ConnectionManager = app.state.websocket_manager
        await manager.handle(websocket)

    @app.get("/")
    async def root() -> dict:
        """Root landing payload with links to docs and health."""
        return {
            "name": settings.app_name,
            "version": settings.app_version,
            "docs": "/docs",
            "health": "/api/v1/health/live",
        }

    return app


app = create_app()
