"""Kokoro TTS via a self-hosted OpenAI-compatible container gateway.

Runs against `hwdsl2/kokoro-server` (Docker, port 8880) — a plain
`POST /v1/audio/speech` endpoint. The gateway synthesizes at 24 kHz; this
engine decodes the returned WAV and resamples to the TtsEngine contract of
raw 16-bit mono PCM @ 16 kHz (pure-Python linear interpolation, no numpy).

Network, timeout, or decode failures never raise to the caller: the engine
logs a warning and falls back to an injected offline engine so voice output
always exists.
"""
import contextlib
import io
import logging
import struct
import time
import wave
from pathlib import Path

from app.ai.voice.base import TtsEngine
from app.ai.voice.offline import OfflineTtsEngine

logger = logging.getLogger(__name__)

_PCM_RATE = 16000
_WAVE_BITS = 16
_OFFLINE_COOLDOWN_SECONDS = 5.0
_DEFAULT_API_KEY = "not-needed"


def _resample_linear(pcm: bytes, src_rate: int, dst_rate: int) -> bytes:
    """Linearly resample 16-bit mono PCM from `src_rate` to `dst_rate` Hz."""
    if src_rate == dst_rate or not pcm:
        return pcm
    samples = struct.unpack(f"<{len(pcm) // 2}h", pcm[: len(pcm) - len(pcm) % 2])
    if not samples:
        return b""
    n_out = int(len(samples) * dst_rate / src_rate)
    ratio = src_rate / dst_rate
    out = bytearray()
    for i in range(n_out):
        pos = i * ratio
        lo = int(pos)
        hi = min(lo + 1, len(samples) - 1)
        frac = pos - lo
        value = int(samples[lo] * (1.0 - frac) + samples[hi] * frac)
        out += struct.pack("<h", value)
    return bytes(out)


def _wav_to_pcm16_mono(data: bytes, dst_rate: int) -> bytes:
    """Decode a WAV payload into 16-bit mono PCM at `dst_rate` Hz."""
    with wave.open(io.BytesIO(data), "rb") as wav:
        channels = wav.getnchannels()
        sampwidth = wav.getsampwidth()
        src_rate = wav.getframerate()
        frames = wav.readframes(wav.getnframes())

    if sampwidth != 2:
        raise ValueError(f"unsupported WAV sample width {sampwidth * 8}-bit")

    if channels == 1:
        pcm = frames
    elif channels == 2:
        stereo = struct.unpack(f"<{len(frames) // 2}h", frames[: len(frames) - len(frames) % 2])
        pairs = zip(stereo[::2], stereo[1::2], strict=True)
        mono_samples = [(left + right) // 2 for left, right in pairs]
        mono = struct.pack(f"<{len(stereo) // 2}h", *mono_samples)
        pcm = mono
    else:
        raise ValueError(f"unsupported channel count {channels}")

    return _resample_linear(pcm, src_rate, dst_rate)


class KokoroTTSService(TtsEngine):
    """OpenAI-SDK-backed Kokoro TTS with automatic offline fallback."""

    name = "kokoro-api-tts"
    sample_rate = _PCM_RATE

    def __init__(
        self,
        *,
        api_url: str,
        api_key: str = "",
        voice: str = "af_heart",
        model: str = "kokoro",
        timeout_seconds: float = 30.0,
        fallback: TtsEngine | None = None,
    ) -> None:
        self._api_url = api_url.rstrip("/")
        self._api_key = api_key or _DEFAULT_API_KEY
        self._voice = voice
        self._model = model
        self._timeout_seconds = timeout_seconds
        self._fallback = fallback or OfflineTtsEngine()
        self._client = None
        self._unhealthy_until = 0.0

    @property
    def _openai(self):
        """Lazily build the async OpenAI client (import guarded for py3.12+)."""
        if self._client is None:
            from openai import AsyncOpenAI  # local import keeps startup fast

            self._client = AsyncOpenAI(
                base_url=self._api_url,
                api_key=self._api_key,
                timeout=self._timeout_seconds,
                max_retries=0,
            )
        return self._client

    async def synthesize(
        self, text: str, *, voice: str | None = None
    ) -> bytes:
        """Synthesize `text` into raw 16-bit mono PCM @ 16 kHz.

        Falls back to the offline engine when the gateway is unreachable,
        times out, or returns audio that cannot be decoded.
        """
        if not text or not text.strip():
            return b""
        if time.monotonic() < self._unhealthy_until:
            return await self._fallback.synthesize(text, voice=voice)

        try:
            response = await self._openai.audio.speech.create(
                model=self._model,
                voice=voice or self._voice,
                input=text,
                response_format="wav",
            )
            data = response.content
            if not data:
                raise ValueError("gateway returned empty audio")
            return _wav_to_pcm16_mono(data, _PCM_RATE)
        except Exception as exc:  # noqa: BLE001 — any backend failure degrades
            logger.warning(
                "kokoro-api synthesize failed (%s: %s); using offline fallback",
                type(exc).__name__,
                exc,
            )
            self._unhealthy_until = time.monotonic() + _OFFLINE_COOLDOWN_SECONDS
            return await self._fallback.synthesize(text, voice=voice)

    async def synthesize_file(
        self,
        text: str,
        output_path: str | Path,
        *,
        voice: str | None = None,
        response_format: str = "mp3",
    ) -> Path:
        """Stream speech directly to a file (mp3/wav/etc.) via the gateway.

        Raises on failure — file saving is explicit work, not voice fallback.
        """
        path = Path(output_path)
        response = await self._openai.audio.speech.create(
            model=self._model,
            voice=voice or self._voice,
            input=text,
            response_format=response_format,
        )
        data = response.content
        if not data:
            raise ValueError("gateway returned empty audio")
        path.write_bytes(data)
        return path

    async def health(self) -> bool:
        """Probe the gateway; True when reachable (list models)."""
        try:
            await self._openai.models.list()
            return True
        except Exception:  # noqa: BLE001
            return False

    async def close(self) -> None:
        """Release the HTTP client and any fallback resources."""
        with contextlib.suppress(Exception):  # noqa: BLE001
            await self._fallback.close()
        client, self._client = self._client, None
        if client is not None:
            with contextlib.suppress(Exception):  # noqa: BLE001
                await client.close()
