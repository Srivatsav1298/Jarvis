# Roadmap

Backend foundation is live: versioned REST API, WebSocket endpoint, Alembic async
migrations, background scheduler, repository/service layers, and a passing test
suite. This document captures the planned next steps, roughly in priority order.

## 1. Real AI Chat (OpenAI / Anthropic)

Replace the deterministic mock reply in `app/services/chat.py` (`ChatService.respond`)
with a real LLM call. Config placeholders already exist in `Settings`
(`ai_provider`, `ai_model`, `ai_api_key`).

- Add a provider abstraction (`openai` / `anthropic`) keyed off `ai_provider`.
- Persist assistant replies with real token counts and latency (columns already exist
  on `Message`: `tokens`, `latency_ms`).
- Keep the existing `ChatResponse` shape so the API contract is stable.

## 2. Streaming Tokens over WebSocket

Add streaming message types to the WS protocol (`app/websocket/protocol.py`):

- `stream.token` — one token chunk per frame as the model generates.
- `stream.end` — final frame with usage stats (tokens, latency, finish reason).

The `ConnectionManager` already provides `broadcast()` and per-client `send()`;
the scheduler loop and WS receive loop are the natural integration points.

## 3. Vector Memory

`MemoryEntry.embedding` (a JSON `list[float]`) already exists and `MemoryManager._embed`
returns `None` as a placeholder.

- Swap the deterministic `search()` stub (sorts by `importance`) for real
  similarity search.
- Use **pgvector** on PostgreSQL or **sqlite-vec** to keep SQLite dev parity.
- Emit embeddings on create/update via the provider hook.

## 4. Authentication

Single-user token auth is the target for a personal assistant.

- Add an `Authorization: Bearer <token>` dependency; compare against a settings
  value (e.g. `JARVIS_API_TOKEN`) using `secrets.compare_digest`.
- Protect all `/api/v1` routes except `/health/*` and `/system/info`.
- Document the `UnauthorizedError` / `ForbiddenError` envelope codes already
  defined in `app/exceptions/api_errors.py`.

## 5. Tool Registry

`app/tools/` has a working `ToolRegistry` (register/list/invoke, with a default
`ping` tool) but no AI wiring.

- Let the chat service invoke registry tools based on model tool calls.
- Add real tools (calendar, weather, web search) behind the registry interface.

## 6. Voice STT / TTS

Placeholder settings exist (`voice_enabled`, `voice_stt_engine`, `voice_tts_engine`).

- Add a `/voice/transcribe` endpoint and an audio stream path.
- Stream TTS audio back over the WebSocket connection.

## 7. Notification Push

`NotificationService` + endpoints are done; the scheduler sweep currently only
counts due reminders and logs.

- Emit `broadcast` WS events when a reminder comes due or a notification is created.
- Optionally integrate OS push for the desktop/mobile client.

## 8. Containerization & CI

- **Dockerfile + compose**: one container for the API/uvicorn, one for
  PostgreSQL; volume for `data/` when on SQLite.
- **CI**: GitHub Actions running `ruff check`, `pytest`, and `mypy` on push/PR.
  Add `mypy` to the dev dependency group and a `[tool.mypy]` config.

## Current Status (at Task 9)

- All 8 REST routers live under `app/api/v1/routers/`.
- All 8 models, config, WS infra, structured logging, background scheduler,
  middleware, lifespan, tests, and docs are present.
- Chat and memory respond deterministically; no AI or auth yet.
