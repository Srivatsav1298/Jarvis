# AI Providers

This document explains how the backend resolves and talks to LLM providers, how
auto-routing works, and how to add a new provider.

## Provider Adapters

Every provider is an `AIProvider` (see `app/ai/providers/base.py`) exposing:

| Member | Purpose |
|--------|---------|
| `name` | Provider id used in settings and events |
| `base_url` | Endpoint the adapter targets |
| `models()` | List available models |
| `health() -> Health` | Reachability/readiness probe (network ok, models present) |
| `complete(messages) -> ProviderReply` | One-shot completion |
| `stream(messages) -> AsyncIterator[Chunk]` | Server-sent event stream |

Built-in adapters (all under `app/ai/providers/`):

- **`ollama.py`** — the default. Talks to a local Ollama server
  (`http://127.0.0.1:11434`) via `/api/tags` for health and
  `/api/chat` for streaming. `health()` reports `ok=False` when the server has
  no models, so routing can fall back.
- **`openai_compat.py`** — any OpenAI-compatible chat-completions endpoint
  (OpenAI, Together, Groq, LM Studio, vLLM, etc.). Uses the same SSE contract.
- **`gemini.py`** — Google Gemini `generateContent` streaming endpoint.
- **`fallback.py`** — zero-dependency deterministic responder. Always healthy,
  never network-dependent, produces plausible markdown replies. This is what
  keeps the app usable with no model running at all.

All adapters share the `_http.py` SSE helper (`iter_sse`) for chunk parsing, so
adding a provider usually only means mapping the provider's wire format.

## Auto-Routing

`build_provider(settings)` in `app/ai/providers/factory.py`:

1. Reads `Settings.ai_provider` (default `ollama`).
2. Instantiates the adapter and calls `health()`.
3. If healthy → return it. If unhealthy and `Settings.ai_auto_fallback` is
   enabled → fall back through `Settings.ai_fallback_provider` (default
   `fallback`) and log `resolved provider: fallback | auto-routed: True`.
4. If the chosen provider name is unknown, `UnknownProviderError` is raised.

`AIManager` (`app/ai/registry.py`) wraps the resolved provider, caches its
capability/health snapshot, and exposes the resolved provider + model + routing
decision (`auto_routed`) for services, endpoints, and events.

## Configuration

| Setting | Default | Meaning |
|---------|---------|---------|
| `ai_provider` | `ollama` | Primary provider id |
| `ai_model` | `llama3.2` | Model name passed to the provider |
| `ai_api_key` | `""` | API key for hosted providers |
| `ai_timeout_seconds` | `120.0` | Per-request timeout |
| `ai_ollama_base_url` | `http://localhost:11434` | Ollama endpoint |
| `ai_openai_base_url` | `https://api.openai.com/v1` | OpenAI-compatible endpoint |
| `ai_openrouter_base_url` | `https://openrouter.ai/api/v1` | OpenRouter endpoint |
| `ai_lmstudio_base_url` | `http://localhost:1234/v1` | LM Studio endpoint |
| `ai_gemini_base_url` | `https://generativelanguage.googleapis.com` | Gemini endpoint |
| `ai_extra_headers` | `{}` | Extra headers for hosted providers |
| `ai_auto_fallback` | `true` | Auto-route to fallback when primary is unhealthy |
| `ai_fallback_provider` | `fallback` | Provider used by auto-routing |
| `ai_max_tokens` | `2048` | Generation token cap |
| `ai_temperature` | `0.7` | Sampling temperature |

## Adding a Provider

1. Create `app/ai/providers/<name>.py` with a class extending `AIProvider`.
2. Implement `health()`, `complete()`, and `stream()` (reuse `iter_sse`).
3. Register it in the `PROVIDERS` map in `app/ai/providers/factory.py`.
4. Add tests in `tests/unit/test_ai_layer.py` using a fake HTTP transport.

No router, service, or chat code needs to change — the layer is provider-agnostic.

## Offline / No-Model Operation

With Ollama not running (or model-less), auto-routing selects the `fallback`
provider. Chat replies flow through the full conversation engine (history,
budgeting, memory) but are produced deterministically — `model` in the response
is the configured `ai_model` for display while `resolved provider: fallback`
is logged. This keeps the whole system demoable and testable offline.
