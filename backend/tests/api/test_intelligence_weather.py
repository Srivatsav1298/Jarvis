"""API tests for /intelligence/weather (Open-Meteo, keyless)."""
from app.services.weather import DailyForecast, Weather


async def test_weather_returns_live_payload(client, monkeypatch):
    async def fake_get_current(self):
        return Weather(
            location="Oslo, Norway",
            temperature_c=18.5,
            feels_like_c=17.0,
            condition="Partly cloudy",
            humidity=61,
            wind_kmh=12.3,
            daily=[
                DailyForecast(
                    date="2026-08-06", condition="Rain", temp_min_c=14.0, temp_max_c=19.0
                )
            ],
        )

    monkeypatch.setattr(
        "app.api.v1.routers.intelligence.WeatherService.get_current",
        fake_get_current,
    )
    resp = await client.get("/api/v1/intelligence/weather")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    weather = body["data"]
    assert weather["location"] == "Oslo, Norway"
    assert weather["temperature_c"] == 18.5
    assert weather["condition"] == "Partly cloudy"
    assert len(weather["daily"]) == 1
    assert weather["daily"][0]["date"] == "2026-08-06"
