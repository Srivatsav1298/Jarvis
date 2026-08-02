"""System service — runtime metadata for the /system/info endpoint."""
import platform

from app.config.settings import Settings


class SystemService:
    """Returns static runtime information about the backend process."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def info(self) -> dict[str, str]:
        """Return name, version, environment and interpreter details."""
        return {
            "name": self.settings.app_name,
            "version": self.settings.app_version,
            "environment": self.settings.environment,
            "python": platform.python_version(),
            "platform": platform.system(),
        }
