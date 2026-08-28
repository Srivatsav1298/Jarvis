"""Aggregates all v1 routers under the /api/v1 prefix."""
from fastapi import APIRouter

from app.api.v1.routers import (
    chat,
    conversations,
    health,
    intelligence,
    memory,
    notifications,
    preferences,
    projects,
    reminders,
    settings,
    system,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(system.router)
api_router.include_router(chat.router)
api_router.include_router(intelligence.router)
api_router.include_router(conversations.router)
api_router.include_router(memory.router)
api_router.include_router(notifications.router)
api_router.include_router(preferences.router)
api_router.include_router(reminders.router)
api_router.include_router(settings.router)
api_router.include_router(projects.router)
