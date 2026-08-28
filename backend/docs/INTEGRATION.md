# Integration Guide

How to run the IronmanJARVIS full stack — FastAPI backend + React/Vite frontend —
and how the two talk to each other over REST and WebSocket.

## Quick Start

```bash
# 1. Backend — install deps, migrate, boot on :8000
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000

# 2. Frontend — install deps, dev server on :5173 (proxies /api + /ws to :8000)
cd ..
npm install
npm run dev
```

Open http://localhost:5173. API docs: http://127.0.0.1:8000/docs.

## Configuration

The backend reads `backend/.env` (optional). Everything has sensible defaults:

| Setting | Default | Notes |
|---------|---------|-------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./data/jarvis.db` | Relative to `backend/`; alembic creates it |
| `API_PREFIX` | `/api/v1` | All REST routes are namespaced under this |
| `CORS_ORIGINS` | `["http://localhost:5173", "http://localhost:4173"]` | Frontend dev/preview |
| `AI_PROVIDER` / `AI_MODEL` | `openai` / `gpt-4o-mini` | Placeholders — responses are deterministic mock text, no AI calls yet |
| `HOST` / `PORT` | `127.0.0.1` / `8000` | Uvicorn bind |

Frontend: `VITE_API_URL` in `src/env` or `.env.local`. When empty, requests go to
the Vite dev proxy — `/api/*` → `http://127.0.0.1:8000`, `/ws` → `ws://127.0.0.1:8000`
(configured in `vite.config.ts`).

## REST API

Every endpoint returns the uniform envelope:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "status": 404, "code": "not_found", "title": "Not Found", "detail": "..." } }
```

Probe health:

```bash
curl http://127.0.0.1:8000/api/v1/health/live
# {"success":true,"data":{"status":"ok"}}
```

Live system metrics (polled by the frontend every 1s while WS is closed):

```bash
curl http://127.0.0.1:8000/api/v1/system/metrics
```

Resource endpoints (all under `/api/v1`):

| Resource | Endpoints |
|----------|-----------|
| Conversations | `GET/POST /conversations`, `GET/PATCH/DELETE /conversations/{id}` |
| Chat | `POST /chat` (accepts, then streams over WS — see below) |
| Notifications | `GET/POST /notifications`, `PATCH /notifications/{id}/read?read=true`, `DELETE /notifications/{id}` |
| Memory | `GET/POST /memory/entries`, `GET/PATCH/DELETE /memory/entries/{id}`, `GET /memory/entries?kind=` |
| Preferences | `GET /preferences`, `PUT /preferences` (merge `{data: {...}}`) |
| Projects | `GET/POST /projects`, `GET/PATCH/DELETE /projects/{id}` |
| Reminders | `GET/POST /reminders`, `GET/PATCH/DELETE /reminders/{id}` |
| Settings | `GET /settings`, `PATCH /settings` (merge `{data: {...}}`) |
| System | `GET /system/metrics`, `GET /system/health` |

Conversation CRUD:

```bash
CID=$(curl -s -X POST http://127.0.0.1:8000/api/v1/conversations \
  -H 'Content-Type: application/json' -d '{"title":"E2E Test"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["id"])')

curl -s -X PATCH "http://127.0.0.1:8000/api/v1/conversations/$CID" \
  -H 'Content-Type: application/json' -d '{"pinned":true}'

curl -s http://127.0.0.1:8000/api/v1/conversations
```

## WebSocket Streaming

Connect to `ws://127.0.0.1:8000/ws`. The server greets each client on connect:

```json
{ "version": 1, "type": "hello", "payload": { "active": 1 } }
```

### Chat stream

1. `POST /api/v1/chat` with `{ "message": "...", "request_id": "req-1", "conversation_id": "..." }`
   (only `message` is required). The response carries the `request_id` back.
2. The server then pushes chat lifecycle events to **all connected clients**:

```
chat.started → ai.thinking → chat.chunk* → chat.end
```

Each event is an envelope with a namespaced `type`:

```json
{ "version": 1, "type": "chat.started", "payload": { "request_id": "req-1", "conversation_id": "..." } }
{ "version": 1, "type": "ai.thinking",   "payload": { "request_id": "req-1" } }
{ "version": 1, "type": "chat.chunk",    "payload": { "request_id": "req-1", "text": "Understood," } }
{ "version": 1, "type": "chat.end",      "payload": { "request_id": "req-1", "conversation_id": "...", "message_id": "...", "model": "gpt-4o-mini", "latency_ms": 122, "token_count": 11 } }
```

3. Cancel mid-stream by sending `chat.cancel`; the server replies `chat.cancelled`:

```json
{ "version": 1, "type": "chat.cancel", "payload": { "request_id": "req-1" } }
```

### Push channels

While connected you will also receive:

| Type | Payload | Cadence |
|------|---------|---------|
| `system.metrics` | full metrics snapshot | every 1s, only when CPU% or RAM% changed (delta-gated) |
| `notification.created` | a full `NotificationRead` JSON | whenever a notification is POSTed |

### Heartbeat

The client should ping the server periodically; the server replies `pong`:

```json
{ "version": 1, "type": "ping", "payload": { "ts": 1720000000.0 } }
```

On disconnect, the server removes the client from its broadcast set; the
frontend `WsClient` auto-reconnects with exponential backoff (1s → 30s).

### Minimal WS client

```python
import asyncio, json, uuid, httpx, websockets

async def main():
    async with websockets.connect("ws://127.0.0.1:8000/ws") as ws:
        print(await ws.recv())  # hello
        rid = str(uuid.uuid4())
        async with httpx.AsyncClient() as c:
            await c.post("http://127.0.0.1:8000/api/v1/chat",
                         json={"message": "hello", "request_id": rid})
        async for raw in ws:
            msg = json.loads(raw)
            t = msg.get("type")
            if t == "chat.chunk":
                print(msg["payload"]["text"], end="")
            if t in ("chat.end", "chat.error"):
                break

asyncio.run(main())
```

## Frontend Service Layers

The React app talks to the backend through thin service modules in `src/services`:

| Module | Purpose |
|--------|---------|
| `api.ts` | Envelope-aware REST client; unwraps `data`, throws `ApiError` on `{success:false}` or HTTP 5xx, retries with backoff |
| `events.ts` | Mirror of the backend message-type constants (single source of truth: backend) |
| `ws.ts` | `WsClient` singleton — connect/reconnect, typed `subscribe`, heartbeat |
| `chat.ts` | `streamChat()` — POST `/chat`, subscribe `chat.*`, yield tokens, cancel on abort |

Zustand stores consume these and feed the UI:

| Store | Source |
|-------|--------|
| `connectionStore` | WS status / latency / reconnect count |
| `metricsStore` | `GET /system/metrics` + `system.metrics` WS events |
| `chatStore` | `GET/POST/PATCH/DELETE /conversations`, `streamChat` |
| `notificationStore` | `GET/PATCH /notifications`, `notification.created` WS events |
| `memoryStore` | `GET /projects`, `GET /preferences`, `GET /memory/entries`, `GET/PATCH /settings` |

## Verifying the Full Stack

Boot both servers, then:

1. Health envelope — `curl http://127.0.0.1:8000/api/v1/health/live`.
2. Metrics — `curl http://127.0.0.1:8000/api/v1/system/metrics`.
3. Chat stream — connect a WS client, `POST /chat`, watch `chat.started → … → chat.end`.
4. Notification broadcast — `POST /notifications` while a WS client is connected; observe `notification.created`.
5. Conversation CRUD — create, patch (pin), list, delete.
6. Preferences — `PUT /preferences`.
7. Heartbeat/reconnect — send `ping`, expect `pong`; drop the socket, watch the frontend re-connect.

Run the suites:

```bash
cd backend && uv run pytest -q && uv run ruff check .
cd .. && npm run typecheck && npm run lint && npx vitest run
```

Both suites are green: 55 backend tests, 55 frontend tests.
