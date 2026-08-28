"""Live weather for Oslo, Norway via Open-Meteo (no API key required).

Open-Meteo is a free, keyless forecast API. The service degrades to a
minimal payload when the network is unreachable so the Intelligence page
never blocks on weather.
"""

from dataclasses import dataclass, field
from datetime import UTC, datetime

import httpx

from app.utils.logging import get_logger

logger = get_logger("app.services.weather")

_DEFAULT_TIMEOUT = 8.0
_OSLO = {"latitude": 59.9139, "longitude": 10.7522}
_WEATHER_API = "https://api.open-meteo.com/v1/forecast"

_WMO_CONDITIONS: dict[int, str] = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    56: "Freezing drizzle",
    57: "Freezing drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Freezing rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Light showers",
    81: "Showers",
    82: "Heavy showers",
    85: "Snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Thunderstorm with hail",
}


@dataclass
class DailyForecast:
    """One forecast day for the five-day outlook."""

    date: str
    condition: str
    temp_min_c: float
    temp_max_c: float


@dataclass
class Weather:
    """Normalized current conditions matching the frontend Weather shape."""

    location: str = "Oslo, Norway"
    temperature_c: float = 0.0
    feels_like_c: float = 0.0
    condition: str = "Unknown"
    humidity: int = 0
    wind_kmh: float = 0.0
    updated_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())
    daily: list[DailyForecast] = field(default_factory=list)


def _condition(code: int | None) -> str:
    if code is None:
        return "Unknown"
    return _WMO_CONDITIONS.get(int(code), "Unknown")


class WeatherService:
    """Fetches current conditions and a five-day outlook from Open-Meteo."""

    def __init__(
        self,
        client: httpx.AsyncClient | None = None,
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> None:
        self._client = client
        self._timeout = timeout

    async def get_current(self) -> Weather:
        """Return live Oslo weather; minimal payload on failure."""
        params = {
            **_OSLO,
            "current": (
                "temperature_2m,apparent_temperature,relative_humidity_2m,"
                "weather_code,wind_speed_10m"
            ),
            "daily": "weather_code,temperature_2m_max,temperature_2m_min",
            "timezone": "Europe/Oslo",
            "forecast_days": 5,
        }
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(
            timeout=self._timeout, follow_redirects=True
        )
        try:
            resp = await client.get(_WEATHER_API, params=params)
            resp.raise_for_status()
            return self._normalize(resp.json())
        except Exception as exc:  # noqa: BLE001 — weather must degrade gracefully
            logger.warning(
                "weather_fetch_error",
                extra={"extra_fields": {"error": type(exc).__name__}},
            )
            return Weather()
        finally:
            if owns_client:
                await client.aclose()

    def _normalize(self, payload: dict) -> Weather:
        current = payload.get("current") or {}
        daily = payload.get("daily") or {}
        dates = daily.get("time") or []
        codes = daily.get("weather_code") or []
        temp_max = daily.get("temperature_2m_max") or []
        temp_min = daily.get("temperature_2m_min") or []
        forecast = [
            DailyForecast(
                date=dates[i],
                condition=_condition(codes[i] if i < len(codes) else None),
                temp_min_c=float(temp_min[i]) if i < len(temp_min) else 0.0,
                temp_max_c=float(temp_max[i]) if i < len(temp_max) else 0.0,
            )
            for i in range(len(dates))
        ]
        return Weather(
            temperature_c=float(current.get("temperature_2m") or 0.0),
            feels_like_c=float(current.get("apparent_temperature") or 0.0),
            condition=_condition(current.get("weather_code")),
            humidity=int(current.get("relative_humidity_2m") or 0),
            wind_kmh=float(current.get("wind_speed_10m") or 0.0),
            updated_at=datetime.now(UTC).isoformat(),
            daily=forecast,
        )
