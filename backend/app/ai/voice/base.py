"""Voice engine interfaces — provider-agnostic STT / TTS / wake-word.

Engines are selected via settings (voice_stt_engine, voice_tts_engine) by the
factory; concrete backends (offline, openai, whisper, speech) implement these
protocols. Audio payloads are raw 16-bit mono PCM, 16 kHz.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class SttResult:
    """A speech-recognition result."""

    text: str
    confidence: float = 0.0
    is_final: bool = True
    language: str = "en"
    segments: list[dict] = field(default_factory=list)


@dataclass
class WakeDetection:
    """Outcome of scanning one audio frame for the wake phrase."""

    triggered: bool
    phrase: str = ""
    confidence: float = 0.0


class SttEngine(ABC):
    """Speech-to-text engine contract."""

    name: str = "stt"

    @abstractmethod
    async def transcribe(self, audio: bytes, sample_rate: int = 16000) -> SttResult:
        """Transcribe raw PCM audio into text."""

    async def close(self) -> None:  # noqa: B027 — engines may not need cleanup
        """Release engine resources; default no-op."""


class TtsEngine(ABC):
    """Text-to-speech engine contract."""

    name: str = "tts"
    sample_rate: int = 16000

    @abstractmethod
    async def synthesize(self, text: str, *, voice: str | None = None) -> bytes:
        """Synthesize text into raw 16-bit mono PCM audio."""

    async def close(self) -> None:  # noqa: B027
        """Release engine resources; default no-op."""


class WakeWordEngine(ABC):
    """Wake-word detection contract over streaming PCM frames."""

    name: str = "wake"

    @abstractmethod
    def scan(self, audio: bytes, sample_rate: int = 16000) -> WakeDetection:
        """Scan one frame; returns trigger state when the phrase is heard."""
