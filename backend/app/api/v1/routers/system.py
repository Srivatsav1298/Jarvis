"""System endpoints: runtime metadata."""
from fastapi import APIRouter, Request

from app.config.settings import Settings
from app.services.system import SystemService

router = APIRouter(tags=["system"])


@router.get("/system/info")
async def system_info(request: Request) -> dict[str, str]:
    """Return name, version and runtime environment metadata."""
    settings: Settings = request.app.state.settings
    return SystemService(settings).info()
