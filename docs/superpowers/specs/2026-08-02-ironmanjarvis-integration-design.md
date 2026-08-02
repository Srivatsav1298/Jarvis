# IronmanJARVIS — Backend ↔ Frontend Integration Design

**Date:** 2026-08-02
**Status:** Approved (brainstorming)
**Scope:** Connect the four target panels (Chat, System Monitoring, Notifications, Memory/Settings) to the FastAPI backend; build the realtime/streaming infrastructure. Career/Intelligence/Automation/Schedule/Workspace panels are **out of scope** and keep their current mock data for a future project.

---

## 1. Goal & Constraints

- Connect every widget of the four target panels to backend APIs; backend is the single source of truth.
- Replace mock values in `src/services/` (chat, notifications, memory) and the ripple simulation in `src/stores/metricsStore.ts` with backend-backed data.
- Keep frontend changes **minimal** — swap data sources inside existing Zustand stores/services; UI components effectively unchanged.
- Standardized REST envelope, standardized errors, WebSocket-first streaming, Pydantic validation, centralized exception handling, documentation.
- Choose infrastructure that also serves future voice, memory-retrieval, and tool-calling without re-architecture.

---

## 2. Architecture Decisions

We adopt **Approach A** (store-seam swap + thin API/WS clients) incorporating the 16 review refinements:

1. **Chat streams over WebSockets, not SSE.** `POST /chat` returns `{request_id, conversation_id}`; the reply streams as WS events on the same connection that carries metrics and notifications.
2. **Metrics are event-driven** (cached snapshot, delta-sensitive → broadcast).
3. **Request IDs** on every chat request; every chunk echoes it (retry + interruption ready).
4. **AI state events** (`ai.thinking`, `ai.tool_call`, …) emitted even before voice, to drive accurate orb animations.
5. **Versions WS messages**: envelope `{version: 1, type, payload}`.
6. **Conversation metadata** stored on the row.
7. **`MetricsProvider` interface** (+ `LocalMetricsProvider`), swap later for `NativeMetricsProvider`.
8. **`NotificationService.publish()`** single entry point (repository + websocket now; email/logs later).
9. **`ConversationService`** and **`ChatService`** split from one chat service.
10. **Heartbeat/connection metrics** exposed (latency, quality, reconnect count, last ping).
11. **Central event-name constants** — no hardcoded string messages.
12. **REST envelope** `{success, data}` / `{success:false, error}` on every endpoint (existing endpoints updated).
13. **Typing/state sequence** before first chunk: `chat.started → ai.thinking → chat.chunk* → chat.end`.
14. **Cancellation** `chat.cancel {request_id}`; server cancels the in-flight stream.
15. **Namespaced event names** (`system.*`, `chat.*`, `notification.*`, `memory.*`, `voice.*`).
16. **Frontend `connectionStore`** tracks API/WS/latency/reconnect/status.

---

## 3. Backend — New Dependencies & Config

- Add `psutil>=5.9` to `backend/pyproject.toml` (runtime dependency).
- New module `app/services/metrics.py` — `MetricsProvider` (interface) + `LocalMetricsProvider(psutil)`.
- Extend `app/websocket/protocol.py` → new file `app/websocket/events.py` for namespaced message-name constants (single source of truth).
- New settings/constants: `METRICS_BROADCAST_MAX_SECONDS = 1.0`, `METRICS_BROADCAST_DELTA` (metrics), heartbeat `PING_INTERVAL_SECONDS = 30.0`.
- Scheduler registers a `metrics_push` task.

### WebSocket message contract

Client → server:

| Message | Direction | Payload |
|---------|-----------|---------|
| `ping` | c→s | `{ts}` |
| `heartbeat` | c→s | `{ts}` |
| `chat.cancel` | c→s | `{request_id}` |

Server → client (all `{version:1, type, payload}`):

| Message | payload |
|---------|---------|
| `hello` | `{active, client_id}` |
| `pong` | `{ts}` |
| `system.metrics` | full metric snapshot (delta-gated) |
| `notification.created` | `NotificationRead` |
| `chat.started` | `{request_id, conversation_id, model}` |
| `ai.thinking` | `{request_id}` |
| `chat.chunk` | `{request_id, text}` |
| `chat.end` | `{request_id, conversation_id, message_id, model, latency_ms, token_count}` |
| `chat.cancelled` | `{request_id}` |
| `chat.error` / `ai.error` | `{request_id, code, message}` |
| `memory.updated` | `{scope}` (reserved, emitted on mutations) |
| `broadcast`, `system` | generic |

Reserved (not yet emitted): `voice.started`, `voice.finished`, `ai.context_loaded`, `ai.tool_call`, `ai.streaming` (retained for future). The namespaced constant set lives in `app/websocket/events.py`.

### REST envelope

Every REST response => `{"success": true, "data": <model>}`; errors (through these centralized handlers) => `{"success": false, "error": {"type", "title", "status", "code", "detail"}}`. Existing list endpoints wrap the `ListResponse` inside `data`. Update existing endpoint tests.

### Endpoints added

- `GET /api/v1/system/metrics` → `SystemMetrics` snapshot.
- `GET /api/v1/conversations` | `POST /api/v1/conversations` | `GET/PATCH/DELETE /api/v1/conversations/{id}` — managed by `ConversationService`.
- `POST /api/v1/chat` → `{request_id, conversation_id, model}` (starts an async WS task), managed by `ChatService`.
- `POST /api/v1/chat/cancel` (fallback, HTTP) optional — primary cancel is via WS.
- `GET /api/v1/notifications` | `POST /api/v1/notifications` | `PATCH /notifications/{id}/read` existing; now **broadcast** via `publish()`.
- `GET/PUT/PATCH/DELETE /api/v1/preferences` → `PreferenceRepository.upsert`, `get_all`.
- `GET /api/v1/memory/entries?kind=` filter (memory, fact/pinned/goal).

### Chat streaming pipeline

1. `POST /chat` — `ChatService.publish_request(request_id, payload)`:
   - create/repurpose conversation;
   - store `user` message;
   - register a background `asyncio.Task` (`ChatStreamTask`) keyed by `request_id` with a `asyncio.Queue`.
   - return `102/200` with `{request_id, conversation_id}`.
2. `ChatService.run_stream(request_id)` — yields (through `ai.thinking` → `chat.chunk*` → `chat.end`) and persists the assistant message.
3. `chat.cancel` or `CancelToken` aborts: persist a partial/`assistant` message (or drop), emit `chat.cancelled`.

The current mock reply is tokenized and streamed; the service/emitter interface is transport-agnostic so a real AI generator can replace the mock later without touching wiring.

### Conversation model columns

Add migration cols: `pinned` (Bool), `last_model` (str, null), `last_activity` (DateTime), `message_count` (int, def 0), `created_by` (str, null). Kept minimal but present and populated by ChatService/ConversationService.

---

## 4. Frontend — New Infrastructure

- `vite.config.ts`: `server.proxy` → `/api → http://127.0.0.1:8000`, `/ws → ws://127.0.0.1:8000` (ws:true). CORS already tolerates 5173.
- `src/services/api.ts`: `API_BASE = import.meta.env.VITE_API_URL ?? ''`; `request<T>` with JSON `/api/v1`, **unwraps envelope** `{success,data}` vs `{success:false,error}` → `ApiError`; timeout; exponential-backoff retry (network/5xx, 3x; idempotent GET/DELETE via `request_id` safe); `get/post/patch/put/del`.
- `src/services/ws.ts` `WsClient`: connect with `ping` heartbeat; auto-reconnect backoff (1s→30s) with `onReconnect`; dispatch by `type` to subscribers; expose `latencyMs`, `reconnectCount`, `lastPingAt`, `status`.
- `src/services/events.ts`: mirror of backend `events.py` namespaced constants (documented as source of truth = backend).
- `src/stores/connectionStore.ts`: tracks API status, WS status, latency, reconnect count, quality; any component can read it; drives UI reconnecting indicator.
- `src/hooks/useApiResource.ts`: `{data, loading, error, refresh, retry}`.
- `src/services/stream.ts` (chat): `streamChat({conversationId, prompt, requestId, signal}) => AsyncGenerator<string>` that `POST /api/v1/chat` then consumes `chat.started/ai.thinking/chat.chunk/chat.end` from the WS for `request_id`, honoring `signal` (sends `chat.cancel`).

### Store seams (UI unchanged)

- **metricsStore** — replace random-walk `evolve()`:
  - on `start()`: `GET /system/metrics` snapshot → populate; then WS `system.metrics` pushes update live call; append to 60-length history ring.
  - connection recovery: if WS down → poll `GET /system/metrics` every 1s; on WS re-connect stop poll.
  - `mic`/`camera`/`location` remain browser-derived.
- **chatStore** — `seedConversations()` → `loadConversations()` (GET `/conversations`); send path uses `streamChat`; delete/pin via API; history via `GET /conversations/{id}`; Stop button aborts → `chat.cancel`.
- **NotificationCenter** — `GET /notifications` on load; WS `notification.created` prepend + toast; mark-read/mark-all via PATCH.
- **memoryStore** — `GET /projects`, `GET /preferences`, `GET /memory/entries?kind=`, `GET/PATCH /settings`; localStorage seed dropped (backend is source of truth).
- **SettingsPage** — `GET/PATCH /settings`.

---

## 5. Error Handling, Loading, Retry, Recovery

- Backend: keep existing Pydantic validation + centralized handlers; change response contract to the envelope; ensure 4xx must not be retried, 5xx idempotent ones are.
- Frontend: `ApiError` → toast + inline `ErrorState`; `retry` on 5xx/network; WS: silent autoreconnect with `connectionStore`; active chat streams auto-cancel+retransmit on reconnect (idempotent via `request_id`).

## 6. Testing

- Backend (pytest, `uv run pytest -q`):
  - `/system/metrics` returns expected shape (psutil mocked);
  - conversation CRUD + metadata;
  - WS chat pipeline: `post /chat` → subscribe `chat.*` events → `chat.end` with persisted message;
  - `chat.cancel` stops the stream + emits `chat.cancelled`;
  - envelope shape on all endpoints;
  - preferences upsert/get/delete; memory `kind` filter; notification broadcast.
  - migration `pinned`/etc. applies.
- Frontend (vitest):
  - `api.test.ts` (mock fetch: envelope, error, retry/backoff);
  - `ws.test.ts` (mock WebSocket: heartbeat, reconnect, latency);
  - update `chat.test`, `metrics.test`, `memoryStore.test` to mock `api.ts`/`ws.ts`.

## 7. Documentation

Update `backend/README.md`: full endpoint reference, WS message contract & heartbeat, streaming example, integration guide (run both servers, proxy), curl/sample usage, test instructions.

---

## 8. Assumptions & Non-Goals

- Single-user; no auth (existing `created_by` col is informational).
- GPU & temperature report `null` (unavailable) — never faked.
- Career/intelligence/automation/schedule/workspace panels remain mock.
- Voice / tool-calling / real-embedding are **future work**; only their protocols/ports are created now.