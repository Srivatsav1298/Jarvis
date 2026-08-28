// Mirror of backend/app/websocket/events.py (single source of truth: backend)
export const WS_V = 1

// --- client -> server ---
export const MSG_PING = 'ping'
export const MSG_HEARTBEAT = 'heartbeat'
export const CHAT_CANCEL = 'chat.cancel'

// --- server -> client (chat / AI lifecycle) ---
export const CHAT_START = 'chat.started'
export const AI_THINKING = 'ai.thinking'
export const CHAT_CHUNK = 'chat.chunk'
export const CHAT_END = 'chat.end'
export const CHAT_CANCELLED = 'chat.cancelled'
export const CHAT_ERROR = 'chat.error'
export const AI_STREAMING = 'ai.streaming' // reserved (future)
export const AI_CONTEXT_LOADED = 'ai.context_loaded' // reserved
export const AI_TOOL_CALL = 'ai.tool_call' // reserved

// --- server -> client (channels) ---
export const SYSTEM_METRICS = 'system.metrics'
export const NOTIFICATION_CREATED = 'notification.created'
export const MEMORY_UPDATED = 'memory.updated'

// --- legacy / generic ---
export const MSG_HELLO = 'hello'
export const MSG_PONG = 'pong'
export const MSG_BROADCAST = 'broadcast'
export const MSG_ERROR = 'error'
export const MSG_SYSTEM = 'system'

// --- future voice ---
export const VOICE_START = 'voice.started'
export const VOICE_END = 'voice.finished'