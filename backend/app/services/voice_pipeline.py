"""VoicePipeline — audio-in → wake gate → STT → reply → TTS → audio-out.

Provider-agnostic: all engines are injected (see app/ai/voice/factory.py), and
the reply stage is an injected async callable so the pipeline stays decoupled
from the chat engine. Used by the /ws/voice streaming endpoint.
"""
from dataclasses import dataclass

from app.ai.voice.base import WakeDetection
from app.ai.voice.factory import VoiceEngineSet


@dataclass
class VoiceTurn:
    """One processed audio turn."""

    triggered: bool
    wake: WakeDetection | None = None
    transcript: str = ""
    reply: str = ""
    audio: bytes = b""


class VoicePipeline:
    """Buffers PCM frames, gates on the wake phrase, and closes the loop."""

    def __init__(
        self,
        engines: VoiceEngineSet,
        *,
        reply_fn=None,
        sample_rate: int = 16000,
        max_buffer_seconds: float = 4.0,
    ) -> None:
        self.engines = engines
        self.reply_fn = reply_fn  # async (text: str) -> str
        self.sample_rate = sample_rate
        self._max_buffer_bytes = int(sample_rate * 2 * max_buffer_seconds)
        self._buffer = b""
        self._closed = False

    async def process_audio(self, audio: bytes) -> VoiceTurn:
        """Feed a PCM frame; returns a triggered turn when the wake word fires.

        On trigger the accumulated buffer is transcribed, replied to, and
        synthesized. The buffer is bounded to avoid unbounded growth on quiet
        streams.
        """
        if self._closed:
            return VoiceTurn(triggered=False)
        self._buffer = (self._buffer + audio)[-self._max_buffer_bytes :]

        detection = self.engines.wake.scan(self._buffer, self.sample_rate)
        if not detection.triggered:
            return VoiceTurn(triggered=False)

        captured_audio = self._buffer
        self._buffer = b""
        stt = await self.engines.stt.transcribe(
            captured_audio or audio, self.sample_rate
        )
        transcript = stt.text or ""

        reply = ""
        if transcript and self.reply_fn is not None:
            reply = await self.reply_fn(transcript)

        audio_out = b""
        if reply:
            audio_out = await self.engines.tts.synthesize(reply)

        return VoiceTurn(
            triggered=True,
            wake=detection,
            transcript=transcript,
            reply=reply,
            audio=audio_out,
        )

    async def close(self) -> None:
        """Release engine resources."""
        if self._closed:
            return
        self._closed = True
        await self.engines.close()
