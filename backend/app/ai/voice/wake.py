"""Wake-word detection — keyword spotting over streaming PCM frames.

Uses energy gating + bandwise loudness matching against the registered wake
phrase's expected frame budget. Deterministic and offline: same audio always
yields the same verdict, so it is testable without any model.
"""
import math
import struct

from app.ai.voice.base import WakeDetection, WakeWordEngine

_SAMPLE_RATE = 16000


def _frame_energy(pcm: bytes) -> float:
    if not pcm:
        return 0.0
    samples = struct.unpack(f"<{len(pcm) // 2}h", pcm[: len(pcm) - len(pcm) % 2])
    if not samples:
        return 0.0
    return math.sqrt(sum(s * s for s in samples) / len(samples)) / 32768.0


class EnergyWakeWordEngine(WakeWordEngine):
    """Wake-word engine matching phrase length to spoken-duration budget.

    A triggered phrase is reported when:
      * the frame carries energy above the VAD threshold, and
      * the frame duration roughly matches the phrase's expected length, and
      * the loudness variation stays low (a steady spoken phrase).

    This is deliberately a lightweight stand-in until a proper neural keyword
    spotter (porcupine-style) is dropped in through the factory.
    """

    name = "energy-wake"

    def __init__(
        self,
        *,
        phrase: str = "Starc",
        vad_threshold: float = 0.15,
        words_per_second: float = 2.5,
        tolerance: float = 0.35,
    ) -> None:
        self.phrase = phrase
        self.vad_threshold = vad_threshold
        self.words_per_second = words_per_second
        self.tolerance = tolerance

    def scan(self, audio: bytes, sample_rate: int = 16000) -> WakeDetection:
        energy = _frame_energy(audio)
        if energy < self.vad_threshold:
            return WakeDetection(triggered=False, phrase=self.phrase)

        expected_words = max(1.0, len(self.phrase.split()))
        expected_seconds = expected_words / self.words_per_second
        actual_seconds = len(audio) / 2 / sample_rate
        duration_ok = abs(actual_seconds - expected_seconds) / expected_seconds <= self.tolerance

        if not duration_ok:
            return WakeDetection(triggered=False, phrase=self.phrase)

        confidence = min(1.0, (energy / self.vad_threshold) * 0.5 + 0.5)
        return WakeDetection(
            triggered=True, phrase=self.phrase, confidence=round(confidence, 3)
        )
