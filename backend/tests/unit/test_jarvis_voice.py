"""Integration test for the container-backed Kokoro TTS engine.

Requires the gateway running: `docker compose up -d kokoro` (hwdsl2/kokoro-server
on port 8880). Tests skip when the gateway is unreachable so the unit suite
never fails without the container.

Verifies the end-to-end pipeline the task asked for: text in → audible
file out (mp3 + wav), plus the raw 16 kHz PCM the voice pipeline consumes.
"""
import struct
import wave

import pytest

from app.ai.voice.factory import build_voice_engines
from app.ai.voice.kokoro_api import KokoroTTSService, _resample_linear


@pytest.fixture
async def service():
    from app.config.settings import Settings

    settings = Settings()  # real .env: KOKORO_API_URL + KOKORO_API_KEY
    svc = KokoroTTSService(
        api_url=settings.kokoro_api_url,
        api_key=settings.kokoro_api_key,
        voice=settings.jarvis_voice_model,
    )
    yield svc
    await svc.close()


async def _gateway_reachable(service) -> bool:
    return await service.health()


@pytest.mark.asyncio
async def test_kokoro_api_health(service):
    if not await service.health():
        pytest.skip("kokoro gateway not reachable — start docker compose")
    assert await service.health() is True


@pytest.mark.asyncio
async def test_kokoro_api_synthesizes_pcm(service, tmp_path):
    if not await service.health():
        pytest.skip("kokoro gateway not reachable — start docker compose")
    pcm = await service.synthesize("Hello there, this is Jarvis speaking.")
    assert len(pcm) > 0
    assert len(pcm) % 2 == 0
    samples = struct.unpack(f"<{len(pcm) // 2}h", pcm)
    assert max(abs(s) for s in samples) > 1000  # audible signal, not silence


@pytest.mark.asyncio
async def test_kokoro_api_file_mp3(service, tmp_path):
    if not await service.health():
        pytest.skip("kokoro gateway not reachable — start docker compose")
    out = await service.synthesize_file(
        "Welcome back. How can I help you today?",
        tmp_path / "jarvis.mp3",
        response_format="mp3",
    )
    assert out.is_file() and out.stat().st_size > 1024
    assert out.read_bytes()[:3] == b"ID3"  # MP3 ID3 header present


@pytest.mark.asyncio
async def test_kokoro_api_file_wav(service, tmp_path):
    if not await service.health():
        pytest.skip("kokoro gateway not reachable — start docker compose")
    out = await service.synthesize_file(
        "Focus mode is now on.",
        tmp_path / "jarvis.wav",
        response_format="wav",
    )
    assert out.is_file() and out.stat().st_size > 1024
    with wave.open(str(out), "rb") as wav:
        assert wav.getnchannels() == 1
        assert wav.getframerate() == 24000  # kokoro-server native rate


@pytest.mark.asyncio
async def test_kokoro_api_unreachable_falls_back_offline(monkeypatch):
    """Gateway down → no raise, offline sine PCM returned."""
    svc = KokoroTTSService(api_url="http://127.0.0.1:1/v1", voice="af_heart")
    pcm = await svc.synthesize("Does not matter")
    assert pcm  # offline fallback produces real PCM
    await svc.close()


def test_resample_linear_preserves_shape():
    """24 kHz → 16 kHz: 3 samples become 2; values bounded to int16."""
    src = struct.pack("<3h", 1000, -2000, 3000)
    out = _resample_linear(src, 24000, 16000)
    assert len(out) == 4  # 2 samples × 2 bytes
    vals = struct.unpack("<2h", out)
    assert all(-32768 <= v <= 32767 for v in vals)


def test_build_voice_engines_kokoro_api():
    from app.config.settings import Settings

    settings = Settings(
        _env_file=None,
        voice_stt_engine="offline",
        voice_tts_engine="kokoro-api",
    )
    engines = build_voice_engines(settings)
    assert engines.tts.name == "kokoro-api-tts"
    assert engines.tts.sample_rate == 16000
