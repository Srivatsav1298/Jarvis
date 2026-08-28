"""Namespaced WebSocket message-type constants (single source of truth).

The frontend mirrors these in `src/services/events.ts`. When adding a message
type here, update the mirror and the README message contract.
"""

# --- client -> server ---
MSG_PING = "ping"
MSG_HEARTBEAT = "heartbeat"
CHAT_CANCEL = "chat.cancel"

# --- server -> client (chat / AI lifecycle) ---
CHAT_START = "chat.started"
AI_THINKING = "ai.thinking"
CHAT_CHUNK = "chat.chunk"
CHAT_END = "chat.end"
CHAT_CANCELLED = "chat.cancelled"
CHAT_ERROR = "chat.error"
AI_STREAMING = "ai.streaming"  # reserved (future)
AI_CONTEXT_LOADED = "ai.context_loaded"  # reserved
AI_TOOL_CALL = "ai.tool_call"  # reserved

# --- server -> client (channels) ---
SYSTEM_METRICS = "system.metrics"
NOTIFICATION_CREATED = "notification.created"
MEMORY_UPDATED = "memory.updated"  # emitted on memory writes

# --- legacy / generic ---
MSG_HELLO = "hello"
MSG_PONG = "pong"
MSG_BROADCAST = "broadcast"
MSG_ERROR = "error"
MSG_SYSTEM = "system"

# --- voice ---
VOICE_START = "voice.started"
VOICE_TRANSCRIPT = "voice.transcript"
VOICE_AUDIO = "voice.audio"
VOICE_END = "voice.finished"