"""Tests for the Voice system (Task 7) — offline STT/TTS + wake word."""
import math
import struct

import pytest

from app.ai.voice.factory import build_voice_engines
from app.ai.voice.offline import OfflineSttEngine, OfflineTtsEngine, _frame_energy
from app.ai.voice.wake import EnergyWakeWordEngine


def _sine_wav(freq: float, duration: float, amplitude: float, sample_rate: int = 16000) -> bytes:
    """Generate a pure sine PCM frame for tests."""
    count = int(sample_rate * duration)
    out = bytearray()
    for i in range(count):
        value = int(amplitude * math.sin(2 * math.pi * freq * i / sample_rate) * 32767.0)
        out += struct.pack("<h", value)
    return bytes(out)


_SILENCE = bytes(16000 * 2)  # 1 second of digital silence


class TestOfflineTts:
    @pytest.mark.asyncio
    async def test_synthesizes_real_pcm(self):
        engine = OfflineTtsEngine()
        audio = await engine.synthesize("hello there")
        assert len(audio) > 0
        assert len(audio) % 2 == 0
        assert _frame_energy(audio) > 0

    @pytest.mark.asyncio
    async def test_empty_text_is_empty_audio(self):
        engine = OfflineTtsEngine()
        assert await engine.synthesize("") == b""
        assert await engine.synthesize("   ") == b""

    @pytest.mark.asyncio
    async def test_same_text_same_audio(self):
        engine = OfflineTtsEngine()
        a = await engine.synthesize("focus mode on")
        b = await engine.synthesize("focus mode on")
        assert a == b

    @pytest.mark.asyncio
    async def test_longer_text_longer_audio(self):
        engine = OfflineTtsEngine()
        short = await engine.synthesize("hi")
        long_ = await engine.synthesize("this is a considerably longer sentence to speak")
        assert len(long_) > len(short)


class TestOfflineStt:
    @pytest.mark.asyncio
    async def test_silence_returns_empty(self):
        engine = OfflineSttEngine()
        result = await engine.transcribe(_SILENCE)
        assert result.text == ""
        assert result.confidence == 0.0

    @pytest.mark.asyncio
    async def test_loud_audio_has_confidence(self):
        engine = OfflineSttEngine(energy_threshold=0.1)
        result = await engine.transcribe(_sine_wav(440, 0.5, 0.5))
        assert result.confidence > 0.0

    @pytest.mark.asyncio
    async def test_registered_phrase_is_returned(self):
        engine = OfflineSttEngine(energy_threshold=0.1)
        engine.register_phrase("focus mode", identifier="focus_mode")
        result = await engine.transcribe(_sine_wav(440, 0.5, 0.5))
        assert result.text == "focus_mode"


class TestWakeWord:
    def test_quiet_audio_never_triggers(self):
        engine = EnergyWakeWordEngine(phrase="Starc", vad_threshold=0.15)
        assert engine.scan(_SILENCE).triggered is False

    def test_short_noise_does_not_trigger(self):
        engine = EnergyWakeWordEngine(phrase="Starc", vad_threshold=0.05)
        # loud but only 50ms — far shorter than "Starc" (~0.8s)
        burst = _sine_wav(440, 0.05, 0.9)
        assert engine.scan(burst).triggered is False

    def test_matching_duration_triggers(self):
        engine = EnergyWakeWordEngine(
            phrase="Starc", vad_threshold=0.05, words_per_second=2.5
        )
        # "Starc" = 1 word → ~0.4s expected; use 0.4s of steady loud audio
        spoken = _sine_wav(440, 0.4, 0.6)
        detection = engine.scan(spoken)
        assert detection.triggered is True
        assert detection.phrase == "Starc"
        assert detection.confidence > 0.5


class TestFactory:
    def test_builds_offline_set_from_settings(self):
        from app.config.settings import Settings

        settings = Settings(
            _env_file=None, voice_stt_engine="offline", voice_tts_engine="offline"
        )
        engines = build_voice_engines(settings)
        assert engines.stt.name == "offline-stt"
        assert engines.tts.name == "offline-tts"
        assert engines.wake.name == "energy-wake"

    def test_unknown_backend_falls_back_to_offline(self):
        from app.config.settings import Settings

        settings = Settings(
            _env_file=None, voice_stt_engine="whisper", voice_tts_engine="does-not-exist"
        )
        engines = build_voice_engines(settings)
        assert engines.stt.name == "offline-stt"
        assert engines.tts.name == "offline-tts"

    def test_kokoro_falls_back_to_offline_when_assets_missing(self, tmp_path):
        from app.config.settings import Settings

        settings = Settings(
            _env_file=None,
            voice_stt_engine="offline",
            voice_tts_engine="kokoro",
            voice_kokoro_model_path=str(tmp_path / "missing.onnx"),
            voice_kokoro_voices_path=str(tmp_path / "missing.bin"),
            voice_kokoro_python_path=str(tmp_path / "missing-python"),
        )
        engines = build_voice_engines(settings)
        assert engines.tts.name == "offline-tts"

    def test_kokoro_builds_when_assets_present(self):
        from app.config.settings import Settings

        settings = Settings(
            _env_file=None,
            voice_stt_engine="offline",
            voice_tts_engine="kokoro",
            voice_kokoro_model_path="voice_assets/kokoro-v1.0.onnx",
            voice_kokoro_voices_path="voice_assets/voices-v1.0.bin",
            voice_kokoro_python_path=".kokoro-venv/bin/python",
        )
        engines = build_voice_engines(settings)
        assert engines.tts.name == "kokoro-tts"
        assert engines.tts.sample_rate == 16000
