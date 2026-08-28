"""Tests for the streaming voice pipeline (Task 8)."""
import math
import struct

import pytest

from app.ai.voice.base import TtsEngine
from app.ai.voice.factory import VoiceEngineSet
from app.ai.voice.offline import OfflineSttEngine
from app.ai.voice.wake import EnergyWakeWordEngine
from app.services.voice_pipeline import VoicePipeline


def _sine_wav(freq: float, duration: float, amplitude: float, sample_rate: int = 16000) -> bytes:
    count = int(sample_rate * duration)
    out = bytearray()
    for i in range(count):
        value = int(amplitude * math.sin(2 * math.pi * freq * i / sample_rate) * 32767.0)
        out += struct.pack("<h", value)
    return bytes(out)


class _EchoTts(TtsEngine):
    name = "echo-tts"
    sample_rate = 16000

    async def synthesize(self, text, *, voice=None):
        return f"audio:{text}".encode()


class _SpokenStt(OfflineSttEngine):
    async def transcribe(self, audio, sample_rate=16000):
        return await super().transcribe(audio, sample_rate)


@pytest.fixture
def pipeline():
    stt = _SpokenStt(energy_threshold=0.1)
    stt.register_phrase("turn on focus mode", identifier="turn on focus mode")
    engines = VoiceEngineSet(
        stt=stt,
        tts=_EchoTts(),
        wake=EnergyWakeWordEngine(phrase="Starc", vad_threshold=0.05),
    )
    return VoicePipeline(engines, reply_fn=_async_reply)


async def _async_reply(text: str) -> str:
    return f"reply:{text}"


class TestVoicePipeline:
    @pytest.mark.asyncio
    async def test_quiet_frame_is_ignored(self, pipeline):
        turn = await pipeline.process_audio(bytes(16000 * 2))
        assert turn.triggered is False
        assert turn.transcript == ""
        assert turn.audio == b""

    @pytest.mark.asyncio
    async def test_wake_word_triggers_full_turn(self, pipeline):
        spoken = _sine_wav(440, 0.4, 0.6)
        turn = await pipeline.process_audio(spoken)
        assert turn.triggered is True
        assert turn.wake is not None
        assert turn.transcript == "turn on focus mode"
        assert turn.reply == "reply:turn on focus mode"
        assert turn.audio == b"audio:reply:turn on focus mode"

    @pytest.mark.asyncio
    async def test_buffer_resets_after_trigger(self, pipeline):
        spoken = _sine_wav(440, 0.4, 0.6)
        await pipeline.process_audio(spoken)
        assert pipeline._buffer == b""
        quiet = await pipeline.process_audio(bytes(16000 * 2))
        assert quiet.triggered is False

    @pytest.mark.asyncio
    async def test_buffer_is_bounded(self):
        stt = _SpokenStt(energy_threshold=0.9)
        engines = VoiceEngineSet(
            stt=stt,
            tts=_EchoTts(),
            wake=EnergyWakeWordEngine(phrase="Starc", vad_threshold=0.9),
        )
        pl = VoicePipeline(engines, max_buffer_seconds=1.0)
        await pl.process_audio(bytes(16000 * 2 * 2))  # 2s > 1s cap
        assert len(pl._buffer) == 16000 * 2

    @pytest.mark.asyncio
    async def test_transcriptless_turn_still_ends(self, pipeline):
        # loud audio that triggers wake but no registered phrase → empty transcript
        pipeline.engines.stt = _SpokenStt(energy_threshold=0.05)
        spoken = _sine_wav(440, 0.4, 0.6)
        turn = await pipeline.process_audio(spoken)
        assert turn.triggered is True
        assert turn.transcript == ""
        assert turn.audio == b""
