"""Unit tests for WeatherService normalization and WMO mapping."""
from app.services.weather import _WMO_CONDITIONS, WeatherService, _condition


def test_wmo_condition_mapping():
    assert _condition(0) == "Clear sky"
    assert _condition(63) == "Rain"
    assert _condition(95) == "Thunderstorm"
    assert _condition(999) == "Unknown"
    assert _condition(None) == "Unknown"
    assert 0 in _WMO_CONDITIONS
    assert 99 in _WMO_CONDITIONS


def test_normalize_parses_current_and_daily():
    payload = {
        "current": {
            "temperature_2m": 21.4,
            "apparent_temperature": 20.1,
            "relative_humidity_2m": 48,
            "weather_code": 2,
            "wind_speed_10m": 9.6,
        },
        "daily": {
            "time": ["2026-08-06", "2026-08-07"],
            "weather_code": [61, 3],
            "temperature_2m_max": [22.0, 19.5],
            "temperature_2m_min": [14.0, 12.0],
        },
    }
    weather = WeatherService()._normalize(payload)
    assert weather.temperature_c == 21.4
    assert weather.feels_like_c == 20.1
    assert weather.humidity == 48
    assert weather.wind_kmh == 9.6
    assert weather.condition == "Partly cloudy"
    assert len(weather.daily) == 2
    assert weather.daily[0].condition == "Light rain"
    assert weather.daily[1].temp_max_c == 19.5


def test_normalize_empty_payload_defaults():
    weather = WeatherService()._normalize({})
    assert weather.temperature_c == 0.0
    assert weather.condition == "Unknown"
    assert weather.daily == []
