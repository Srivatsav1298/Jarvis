"""Voice engine factory — resolves STT / TTS / wake-word from settings.

Keeps backends pluggable: `voice_stt_engine` and `voice_tts_engine` select an
implementation, and any unknown / unavailable name degrades gracefully to the
offline engine rather than crashing the app.
"""
import logging
from pathlib import Path

from app.ai.voice.base import SttEngine, TtsEngine, WakeWordEngine
from app.ai.voice.kokoro import KokoroTtsEngine
from app.ai.voice.kokoro_api import KokoroTTSService
from app.ai.voice.offline import OfflineSttEngine, OfflineTtsEngine
from app.ai.voice.wake import EnergyWakeWordEngine
from app.config.settings import Settings

logger = logging.getLogger(__name__)

# Names that would need external deps/keys; resolve to offline fallback today.
_AWAITABLE_BACKENDS = {"openai", "whisper", "google"}


class VoiceEngineSet:
    """A complete set of voice engines bound to one configuration."""

    def __init__(
        self, *, stt: SttEngine, tts: TtsEngine, wake: WakeWordEngine
    ) -> None:
        self.stt = stt
        self.tts = tts
        self.wake = wake

    async def close(self) -> None:
        """Release engine resources (network backends override these)."""
        for engine in (self.stt, self.tts):
            closer = getattr(engine, "close", None)
            if closer is not None:
                await closer()


def build_voice_engines(settings: Settings) -> VoiceEngineSet:
    """Return the voice engine set selected by `settings`."""
    stt = _build_stt(settings.voice_stt_engine, settings)
    tts = _build_tts(settings.voice_tts_engine, settings)
    wake = EnergyWakeWordEngine(
        phrase=settings.voice_wake_phrase,
        vad_threshold=settings.voice_vad_threshold,
    )
    return VoiceEngineSet(stt=stt, tts=tts, wake=wake)


def _build_stt(name: str, settings: Settings) -> SttEngine:
    if name in _AWAITABLE_BACKENDS:
        logger.warning(
            "voice_stt_engine=%r needs external deps/keys; falling back to offline",
            name,
        )
    return OfflineSttEngine(energy_threshold=settings.voice_vad_threshold)


def _build_tts(name: str, settings: Settings) -> TtsEngine:
    if name == "kokoro":
        return _build_kokoro(settings)
    if name == "kokoro-api":
        return _build_kokoro_api(settings)
    if name in _AWAITABLE_BACKENDS or name not in {"offline", "speech"}:
        logger.warning(
            "voice_tts_engine=%r needs external deps/keys; falling back to offline",
            name,
        )
    return OfflineTtsEngine()


def _build_kokoro_api(settings: Settings) -> TtsEngine:
    """Build the container-backed Kokoro TTS engine.

    The gateway is reachability-checked lazily (on first synthesize), so this
    never blocks startup; unreachable gateways degrade to offline per-synthesize.
    """
    return KokoroTTSService(
        api_url=settings.kokoro_api_url,
        api_key=settings.kokoro_api_key,
        voice=settings.jarvis_voice_model,
    )


def _build_kokoro(settings: Settings) -> TtsEngine:
    """Build the neural kokoro TTS engine, degrading to offline when assets or
    the worker venv are missing so the app never crashes at startup."""
    model = Path(settings.voice_kokoro_model_path)
    voices = Path(settings.voice_kokoro_voices_path)
    python = Path(settings.voice_kokoro_python_path)
    if not model.is_file() or not voices.is_file():
        logger.warning(
            "voice_tts_engine=kokoro but assets missing "
            "(model=%s voices=%s); falling back to offline",
            model,
            voices,
        )
        return OfflineTtsEngine()
    if not python.is_file():
        logger.warning(
            "voice_tts_engine=kokoro but worker python %r missing "
            "(kokoro-onnx needs Python <3.14); falling back to offline",
            python,
        )
        return OfflineTtsEngine()
    return KokoroTtsEngine(
        model_path=str(model),
        voices_path=str(voices),
        python_path=str(python),
        voice=settings.voice_kokoro_voice,
        lang=settings.voice_kokoro_lang,
        speed=settings.voice_kokoro_speed,
    )
