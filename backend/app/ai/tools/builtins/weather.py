"""Weather tool — Open-Meteo based (free, no API key).

Provider-agnostic: the endpoint is configurable via settings later. Falls back
to a deterministic message when offline.
"""

import httpx

from app.ai.tools.registry import Tool

_WEATHER_URL = "https://api.open-meteo.com/v1/forecast"


async def weather_tool(
    location: str = "", lat: float | None = None, lon: float | None = None
) -> dict:
    """Current weather for a lat/lon (or a best-effort geocoded location)."""
    if lat is None or lon is None:
        if not location:
            return {"ok": False, "error": "provide lat/lon or a location name"}
        coords = await _geocode(location)
        if coords is None:
            return {"ok": False, "error": f"could not geocode '{location}'"}
        lat, lon = coords

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                _WEATHER_URL,
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current_weather": "true",
                    "timezone": "auto",
                },
            )
            if resp.status_code != 200:
                return {"ok": False, "error": f"weather backend HTTP {resp.status_code}"}
            data = resp.json()
            current = data.get("current_weather") or {}
            return {
                "ok": True,
                "location": location or f"{lat:.2f},{lon:.2f}",
                "temperature_c": current.get("temperature"),
                "windspeed_kmh": current.get("windspeed"),
                "condition_code": current.get("weathercode"),
                "time": current.get("time"),
            }
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": f"weather unavailable: {type(exc).__name__}: {exc}"}


async def _geocode(location: str) -> tuple[float, float] | None:
    """Best-effort geocode via Open-Meteo's free geocoding API."""
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(
                "https://geocoding-api.open-meteo.com/v1/search",
                params={"name": location, "count": 1, "language": "en", "format": "json"},
            )
            if resp.status_code != 200:
                return None
            results = (resp.json() or {}).get("results") or []
            if not results:
                return None
            return results[0]["latitude"], results[0]["longitude"]
    except Exception:  # noqa: BLE001
        return None


weather = Tool(
    name="weather",
    description="Get the current weather for a location. Use when the user "
    "asks about weather, temperature, or conditions.",
    input_schema={
        "type": "object",
        "properties": {
            "location": {"type": "string", "description": "City/place name"},
            "lat": {"type": "number", "description": "Latitude"},
            "lon": {"type": "number", "description": "Longitude"},
        },
    },
    output_schema={
        "type": "object",
        "properties": {
            "ok": {"type": "boolean"},
            "location": {"type": "string"},
            "temperature_c": {"type": "number"},
            "windspeed_kmh": {"type": "number"},
        },
    },
    handler=weather_tool,
)