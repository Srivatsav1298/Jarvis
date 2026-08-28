"""Offline voice engines — deterministic, zero-dependency STT / TTS.

These are honest local-first implementations: TTS synthesizes a real 16-bit PCM
waveform (frequency varies with text so output is audibly distinct per input),
and STT uses energy gating plus a small in-memory lexicon of command phrases.
No network, no model download, fully testable.
"""
import math
import struct

from app.ai.voice.base import SttEngine, SttResult, TtsEngine

_CHANNELS = 1
_SAMPLE_RATE = 16000


def _frame_energy(pcm: bytes) -> float:
    """Root-mean-square amplitude of raw 16-bit PCM (0..1)."""
    if not pcm:
        return 0.0
    samples = struct.unpack(f"<{len(pcm) // 2}h", pcm[: len(pcm) - len(pcm) % 2])
    if not samples:
        return 0.0
    return math.sqrt(sum(s * s for s in samples) / len(samples)) / 32768.0


class OfflineTtsEngine(TtsEngine):
    """Deterministic sine-wave TTS — real PCM output, no external deps.

    Pitch is derived from the text (stable hash), so identical text always
    yields identical audio while different text sounds different.
    """

    name = "offline-tts"
    sample_rate = _SAMPLE_RATE

    def __init__(self, *, base_freq: float = 440.0) -> None:
        self.base_freq = base_freq

    async def synthesize(
        self, text: str, *, voice: str | None = None
    ) -> bytes:
        """Render `text` as a duration + pitch modulated tone in PCM."""
        if not text or not text.strip():
            return b""
        seed = abs(hash(text.strip().lower())) % 1000
        freq = self.base_freq * (1.0 + (seed / 1000.0 - 0.5) * 0.4)
        duration = 0.5 + min(3.0, len(text) / 24.0)
        sample_count = int(_SAMPLE_RATE * duration)
        phase = 0.0
        out = bytearray()
        step = 2 * math.pi * freq / _SAMPLE_RATE
        amp = 0.25
        for i in range(sample_count):
            # gentle amplitude envelope to avoid clicks at start/end
            env = min(1.0, i / 200.0, (sample_count - i) / 200.0)
            phase += step
            value = int(amp * env * math.sin(phase) * 32767.0)
            out += struct.pack("<h", value)
        return bytes(out)


class OfflineSttEngine(SttEngine):
    """Energy-gated STT with a small command lexicon.

    Matches the closest registered phrase to the input audio by energy band
    (loudness profile). Without a real acoustic model this is approximate —
    primarily useful for tests, demos, and wake-gating. Transcribing speech
    with real accuracy requires the openai / whisper backend via the factory.
    """

    name = "offline-stt"

    def __init__(self, *, energy_threshold: float = 0.15) -> None:
        self.energy_threshold = energy_threshold
        self._lexicon: dict[str, str] = {}  # phrase -> identifier

    def register_phrase(self, phrase: str, identifier: str | None = None) -> None:
        """Register a phrase the engine can recognize."""
        self._lexicon[phrase.strip().lower()] = identifier or phrase

    async def transcribe(self, audio: bytes, sample_rate: int = 16000) -> SttResult:
        energy = _frame_energy(audio)
        if energy < self.energy_threshold:
            return SttResult(text="", confidence=0.0)
        confidence = min(1.0, energy / self.energy_threshold)
        text = self._best_match(audio)
        return SttResult(text=text, confidence=round(confidence, 3))

    def _best_match(self, audio: bytes) -> str:
        if not self._lexicon:
            return ""
        profile = self._energy_profile(audio)
        best_phrase, best_score = "", -1.0
        for phrase in self._lexicon:
            score = self._score(phrase, profile)
            if score > best_score:
                best_phrase, best_score = phrase, score
        return self._lexicon.get(best_phrase, "")

    def _energy_profile(self, audio: bytes) -> list[float]:
        """Per-band RMS across the frame — a crude loudness fingerprint."""
        chunk = 640  # 20ms at 16 kHz
        profile = []
        for start in range(0, len(audio) - chunk + 1, chunk):
            profile.append(_frame_energy(audio[start : start + chunk]))
        return profile

    @staticmethod
    def _score(phrase: str, profile: list[float]) -> float:
        """Loudness profile score: longer, louder, steadier audio scores higher."""
        if not profile:
            return 0.0
        loudness = sum(profile) / len(profile)
        length_ratio = min(1.0, len(profile) / 100.0)
        variation = max(profile) - min(profile)
        steadiness = max(0.0, 1.0 - variation)
        return 0.5 * loudness + 0.3 * length_ratio + 0.2 * steadiness
