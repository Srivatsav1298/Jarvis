import { api } from '@/services/api'
import { socket } from '@/services/ws'
import { uid } from '@/utils/random'
import {
  AI_THINKING,
  CHAT_CANCEL,
  CHAT_CANCELLED,
  CHAT_CHUNK,
  CHAT_END,
  CHAT_ERROR,
  CHAT_START,
  WS_V,
} from '@/services/events'

export interface StreamChatArgs {
  conversationId: string
  prompt: string
  requestId?: string
  signal?: AbortSignal
}

export interface ChatAccepted {
  request_id: string
  conversation_id: string
  model: string
}

/** Resolve once the WS socket is open so chunks aren't emitted before we listen. */
async function waitForSocketOpen(sock: typeof socket, timeoutMs = 8000): Promise<void> {
  const open = () => sock.status === 'open'
  if (open()) return
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (open()) return
    await new Promise<void>((resolve) => setTimeout(resolve, 20))
  }
}

export const streamChat = async function* ({
  conversationId,
  prompt,
  requestId = uid('req'),
  signal,
}: StreamChatArgs): AsyncGenerator<string> {
  const handlers = new Map<string, (payload: Record<string, unknown>) => void>()
  const unsubs: Array<() => void> = []

  await waitForSocketOpen(socket)

  const matches = (payload: Record<string, unknown>) =>
    payload.request_id === requestId

  const collect =
    (queue: string[]) =>
    (payload: Record<string, unknown>) => {
      if (!matches(payload)) return
      const text = payload.text
      if (typeof text === 'string') queue.push(text)
    }

  const queue: string[] = []
  let ended = false
  let aborted = false

  const onAbort = () => {
    aborted = true
    socket.sendRaw({
      version: WS_V,
      type: CHAT_CANCEL,
      payload: { request_id: requestId },
    })
  }
  signal?.addEventListener('abort', onAbort, { once: true })

  for (const type of [CHAT_START, AI_THINKING, CHAT_CHUNK, CHAT_END, CHAT_ERROR, CHAT_CANCELLED]) {
    const cb =
      type === CHAT_CHUNK
        ? collect(queue)
        : (payload: Record<string, unknown>) => {
            if (!matches(payload)) return
            if (type === CHAT_END) ended = true
            if (type === CHAT_ERROR) ended = true
            if (type === CHAT_CANCELLED) {
              ended = true
              aborted = true
            }
          }
    handlers.set(type, cb)
    unsubs.push(socket.subscribe(type, cb))
  }

  try {
    await api.post<ChatAccepted>('/chat', {
      message: prompt,
      conversation_id: conversationId,
      request_id: requestId,
    })

    while (!ended) {
      if (queue.length) {
        yield queue.shift()!
        continue
      }
      if (aborted) return
      await new Promise<void>((resolve) => setTimeout(resolve, 8))
    }
    while (queue.length) yield queue.shift()!
  } finally {
    signal?.removeEventListener('abort', onAbort)
    unsubs.forEach((u) => u())
    handlers.clear()
  }
}

export const chatService = {
  stream: streamChat,
}