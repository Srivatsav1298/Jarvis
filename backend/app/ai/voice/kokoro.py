"""Kokoro-onnx neural TTS engine — real British English speech, local.

kokoro-onnx requires Python <3.14 while the backend venv is 3.14, so this
engine runs a dedicated worker subprocess (see kokoro_worker.py) under a
Python 3.13 venv (default `.kokoro-venv`). The worker loads the model once and
serves PCM over stdin/stdout, so the engine stays a thin async wrapper.

Output contract matches TtsEngine: raw 16-bit mono PCM @ 16 kHz.
"""
import asyncio
import contextlib
import json
import logging
import struct
from pathlib import Path

from app.ai.voice.base import TtsEngine

logger = logging.getLogger(__name__)

_WORKER_SCRIPT = Path(__file__).resolve().parent / "kokoro_worker.py"
_PCM_RATE = 16000
_LEN = struct.Struct("<I")


class KokoroTtsEngine(TtsEngine):
    """Neural TTS via a kokoro-onnx subprocess worker."""

    name = "kokoro-tts"
    sample_rate = _PCM_RATE

    def __init__(
        self,
        *,
        model_path: str,
        voices_path: str,
        python_path: str = ".kokoro-venv/bin/python",
        voice: str = "bf_emma",
        lang: str = "en-gb",
        speed: float = 1.0,
    ) -> None:
        self._model_path = model_path
        self._voices_path = voices_path
        self._python_path = python_path
        self._voice = voice
        self._lang = lang
        self._speed = speed
        self._proc: asyncio.subprocess.Process | None = None
        self._lock = asyncio.Lock()

    async def synthesize(
        self, text: str, *, voice: str | None = None
    ) -> bytes:
        """Render `text` into raw 16-bit mono PCM @ 16 kHz."""
        if not text or not text.strip():
            return b""
        async with self._lock:
            proc = await self._ensure_worker()
            request = json.dumps(
                {
                    "text": text,
                    "voice": voice or self._voice,
                    "lang": self._lang,
                    "speed": self._speed,
                }
            )
            try:
                proc.stdin.write((request + "\n").encode("utf-8"))
                await proc.stdin.drain()
                raw_len = await proc.stdout.readexactly(_LEN.size)
                (length,) = _LEN.unpack(raw_len)
                if length == 0:
                    raise RuntimeError("kokoro worker returned empty audio")
                return await proc.stdout.readexactly(length)
            except (asyncio.IncompleteReadError, BrokenPipeError):
                await self._restart()
                raise

    async def _ensure_worker(self) -> asyncio.subprocess.Process:
        if self._proc is not None and self._proc.returncode is None:
            return self._proc
        self._proc = await asyncio.create_subprocess_exec(
            self._python_path,
            str(_WORKER_SCRIPT),
            self._model_path,
            self._voices_path,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _drain_stderr(self._proc)
        return self._proc

    async def _restart(self) -> None:
        if self._proc is not None:
            with contextlib.suppress(ProcessLookupError):
                self._proc.kill()
            await self._proc.wait()
        self._proc = None
        await self._ensure_worker()

    async def close(self) -> None:
        """Terminate the worker subprocess."""
        async with self._lock:
            proc = self._proc
            self._proc = None
            if proc is None:
                return
            try:
                proc.terminate()
                await asyncio.wait_for(proc.wait(), timeout=2.0)
            except (TimeoutError, ProcessLookupError):
                proc.kill()
                await proc.wait()


def _drain_stderr(proc: asyncio.subprocess.Process) -> None:
    """Forward worker stderr to the app logger without blocking the loop."""

    async def _forward() -> None:
        assert proc.stderr is not None
        while True:
            line = await proc.stderr.readline()
            if not line:
                break
            logger.warning("kokoro worker: %s", line.decode("utf-8", "replace").rstrip())

    with contextlib.suppress(RuntimeError):
        asyncio.create_task(_forward())

# Keep subprocess import reachable for ruff/typing cleanliness.
__all__ = ["KokoroTtsEngine"]
