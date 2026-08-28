"""Kokoro-onnx TTS worker — runs under a Python <3.14 venv.

The main backend venv is Python 3.14, but kokoro-onnx requires Python <3.14,
so KokoroTtsEngine spawns this script under `.kokoro-venv/bin/python`. The
model is loaded once at startup, then requests are served over stdin/stdout:

  stdin : one JSON line  {"text", "voice", "lang", "speed"}
  stdout: 4-byte little-endian length + raw 16-bit mono PCM @ 16 kHz

Anything other than audio (log noise, warnings) goes to stderr, which the
engine reads asynchronously so it never corrupts the PCM channel.
"""
import json
import struct
import sys

import numpy as np
from kokoro_onnx import Kokoro

_TARGET_RATE = 16000


def _to_pcm16(samples: np.ndarray, src_rate: int) -> bytes:
    """Resample (if needed) and convert float samples to 16-bit PCM."""
    samples = np.asarray(samples, dtype=np.float32)
    if src_rate != _TARGET_RATE and samples.size > 1:
        n_in = samples.shape[0]
        n_out = max(1, int(round(n_in * _TARGET_RATE / src_rate)))
        x = np.linspace(0.0, 1.0, n_in)
        xi = np.linspace(0.0, 1.0, n_out)
        samples = np.interp(xi, x, samples)
    samples = np.clip(samples, -1.0, 1.0)
    return (samples * 32767.0).astype(np.int16).tobytes()


def main() -> int:
    model_path = sys.argv[1]
    voices_path = sys.argv[2]
    kokoro = Kokoro(model_path, voices_path)
    stdin = sys.stdin
    stdout = sys.stdout.buffer
    while True:
        line = stdin.readline()
        if not line:
            break
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            samples, sample_rate = kokoro.create(
                req.get("text", ""),
                voice=req.get("voice", "bf_emma"),
                speed=float(req.get("speed", 1.0)),
                lang=req.get("lang", "en-gb"),
            )
            pcm = _to_pcm16(samples, sample_rate)
            stdout.write(struct.pack("<I", len(pcm)))
            stdout.write(pcm)
        except Exception as exc:  # noqa: BLE001 — protocol failure must not kill worker
            stdout.write(struct.pack("<I", 0))
            print(f"kokoro_worker error: {exc!r}", file=sys.stderr)
        stdout.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
