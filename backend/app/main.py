"""Application bootstrap: factory, lifespan, middleware, routers, WebSocket."""
import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket

from app.ai.conversation.factory import build_conversation_manager
from app.ai.conversation.session_manager import SessionManager
from app.ai.providers.factory import resolve_provider
from app.ai.registry import AIManager
from app.ai.voice.factory import build_voice_engines
from app.api.v1.router import api_router
from app.config.settings import Settings, get_settings
from app.core.chat_stream_manager import ChatStreamManager
from app.core.constants import (
    METRICS_PUSH_INTERVAL_SECONDS,
    REMINDER_SWEEP_INTERVAL_SECONDS,
)
from app.database.engine import build_engine, dispose_engine
from app.database.session import build_session_factory
from app.exceptions.handlers import register_exception_handlers
from app.middleware.cors import add_cors
from app.middleware.request_logging import RequestLoggingMiddleware
from app.providers.metrics import get_metrics_provider
from app.providers.notifier import WebSocketNotifier
from app.repositories.implementations import (
    ConversationRepository,
    JobRepository,
    MessageRepository,
    NotificationRepository,
    ReminderRepository,
)
from app.scheduler.scheduler import Scheduler
from app.schemas.chat import ChatMessageRequest
from app.schemas.notification import NotificationCreate
from app.services.chat import ChatService
from app.services.job_refresh import JobRefreshService
from app.services.notifications import NotificationService
from app.services.reminders import ReminderService
from app.services.voice_pipeline import VoicePipeline
from app.utils.logging import configure_logging, get_logger
from app.websocket.events import (
    SYSTEM_METRICS,
    VOICE_AUDIO,
    VOICE_END,
    VOICE_START,
    VOICE_TRANSCRIPT,
)
from app.websocket.manager import ConnectionManager
from app.websocket.protocol import envelope

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

        manager: ConnectionManager = app.state.websocket_manager

        # Resolve the AI provider once at startup; auto-routes to fallback when
        # the configured provider is unreachable (e.g. Ollama without a model).
        ai_provider = await resolve_provider(settings)
        app.state.ai_manager = AIManager(ai_provider, settings.ai_provider)
        shared_session_manager = SessionManager()

        def conversation_factory(session):
            return build_conversation_manager(
                settings, session, session_manager=shared_session_manager
            )

        app.state.chat_manager = ChatStreamManager(
            session_factory=app.state.session_factory,
            settings=settings,
            broadcaster=lambda type_, payload: manager.broadcast(
                envelope(type_, payload)
            ),
            ai_manager=app.state.ai_manager,
            conversation_factory=conversation_factory,
        )

        # Voice pipeline (wake → STT → chat reply → TTS), built lazily only
        # when voice is enabled so default deployments stay dependency-free.
        if settings.voice_enabled:
            voice_engines = build_voice_engines(settings)

            async def voice_reply_fn(text: str) -> str:
                async with app.state.session_factory() as session:
                    service = ChatService(
                        ConversationRepository(session),
                        MessageRepository(session),
                        settings,
                        ai_manager=app.state.ai_manager,
                        conversation_factory=conversation_factory,
                    )
                    response = await service.respond(
                        ChatMessageRequest(message=text)
                    )
                    return response.reply

            app.state.voice_pipeline = VoicePipeline(
                voice_engines, reply_fn=voice_reply_fn
            )
        else:
            app.state.voice_pipeline = None

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

        async def refresh_jobs() -> None:
            """Daily 7:00 AM job-market refresh against live boards."""
            logger.info("job_refresh_start", extra={"extra_fields": {}})
            async with app.state.session_factory() as session:
                report = await JobRefreshService(JobRepository(session)).refresh()
            logger.info(
                "job_refresh_result",
                extra={
                    "extra_fields": {
                        "sources_queried": report.sources_queried,
                        "per_source_count": report.per_source_count,
                        "duplicates_removed": report.duplicates_removed,
                        "scraped_total": report.scraped_total,
                        "persisted": report.persisted,
                        "new_jobs": report.new_jobs,
                        "duration_ms": report.duration_ms,
                    }
                },
            )
            if report.new_jobs > 0:
                async with app.state.session_factory() as session:
                    notifier = WebSocketNotifier(app.state.websocket_manager)
                    service = NotificationService(NotificationRepository(session))
                    await service.publish(
                        NotificationCreate(
                            type="career",
                            severity="accent",
                            title=f"{report.new_jobs} new matching jobs",
                            message=(
                                f"{report.persisted} live roles refreshed from "
                                f"{len(report.sources_queried)} boards."
                            ),
                        ),
                        notifier,
                    )
                logger.info(
                    "job_refresh_notified",
                    extra={"extra_fields": {"new_jobs": report.new_jobs}},
                )

        scheduler.register_daily(
            "job_refresh", refresh_jobs, hour=7, minute=0, timezone="Europe/Oslo"
        )

        async def seed_jobs_on_startup() -> None:
            """Populate the job snapshot on boot so the first visit is instant.

            The scheduled refresh fires at 07:00 Oslo; before that the store
            would be empty. Seeding on startup keeps ``GET /intelligence/jobs``
            non-blocking for the first user of the day.
            """
            logger.info("job_seed_start")
            try:
                async with app.state.session_factory() as session:
                    report = await JobRefreshService(JobRepository(session)).refresh()
                logger.info(
                    "job_seed_complete",
                    extra={
                        "extra_fields": {
                            "persisted": report.persisted,
                            "new_jobs": report.new_jobs,
                            "duration_ms": report.duration_ms,
                        }
                    },
                )
            except Exception as exc:  # noqa: BLE001 — boot must not fail on scrape
                logger.error(
                    "job_seed_failed",
                    extra={"extra_fields": {"error": str(exc)}},
                )

        # Seed the job snapshot on boot (dev/prod only — tests seed on demand).
        if settings.environment != "testing":
            asyncio.create_task(seed_jobs_on_startup())

        provider = get_metrics_provider()
        _last_metrics: dict = {}

        async def metrics_push() -> None:
            snapshot = await provider.snapshot()
            payload = snapshot.model_dump(mode="json")
            current = {
                "cpu_percent": payload["cpu_percent"],
                "ram_percent": payload["ram_percent"],
            }
            if current != _last_metrics:
                _last_metrics.update(current)
                await manager.broadcast(envelope(SYSTEM_METRICS, payload))

        scheduler.register(
            "metrics_push", metrics_push, METRICS_PUSH_INTERVAL_SECONDS
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
            pipeline: VoicePipeline | None = getattr(app.state, "voice_pipeline", None)
            if pipeline is not None:
                await pipeline.close()
            close_provider = getattr(app.state.ai_manager.provider, "close", None)
            if close_provider is not None:
                await close_provider()
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

        async def cancel_chat(raw: dict) -> None:
            rid = (raw.get("payload") or {}).get("request_id")
            if rid:
                await app.state.chat_manager.cancel(rid)

        manager.subscribe("chat.cancel", cancel_chat)
        await manager.handle(websocket)

    @app.websocket("/ws/voice")
    async def voice_endpoint(
        websocket: WebSocket, conversation_id: str | None = None
    ) -> None:
        """Stream audio frames; emits voice.* events plus synthesized replies."""
        await websocket.accept()
        pipeline: VoicePipeline | None = app.state.voice_pipeline
        if pipeline is None:
            await websocket.send_json(envelope(VOICE_END, {"error": "voice disabled"}))
            await websocket.close()
            return
        try:
            while True:
                message = await websocket.receive()
                if message["type"] == "websocket.disconnect":
                    break
                if message["type"] != "websocket.receive":
                    continue
                raw = message.get("text") or message.get("bytes")
                if isinstance(raw, str) and raw == "ping":
                    await websocket.send_json(envelope("pong"))
                    continue
                if not isinstance(raw, (bytes, bytearray)):
                    continue

                turn = await pipeline.process_audio(bytes(raw))
                if not turn.triggered:
                    continue

                await websocket.send_json(
                    envelope(
                        VOICE_START,
                        {
                            "phrase": turn.wake.phrase if turn.wake else "",
                            "confidence": (
                                turn.wake.confidence if turn.wake else 0.0
                            ),
                        },
                    )
                )
                if turn.transcript:
                    await websocket.send_json(
                        envelope(VOICE_TRANSCRIPT, {"text": turn.transcript})
                    )
                if turn.audio:
                    await websocket.send_bytes(turn.audio)
                    await websocket.send_json(envelope(VOICE_AUDIO, {"bytes": len(turn.audio)}))
                await websocket.send_json(
                    envelope(
                        VOICE_END,
                        {"transcript": turn.transcript, "reply": turn.reply},
                    )
                )
        except Exception:  # noqa: BLE001 — client closed mid-stream is normal
            logger.info(
                "voice_stream_closed",
                extra={"extra_fields": {"conversation_id": conversation_id}},
            )
            await pipeline.close()

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
