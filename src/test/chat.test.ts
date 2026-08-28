import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { streamChat } from '@/services/chat'
import { api } from '@/services/api'

const handlers = new Map<string, (payload: Record<string, unknown>) => void>()
const unsubs = new Map<string, () => void>()
const sentRaw: unknown[] = []

vi.mock('@/services/ws', () => ({
  socket: {
    status: 'open',
    subscribe: (type: string, cb: (p: Record<string, unknown>) => void) => {
      handlers.set(type, cb)
      const unsub = () => {
        handlers.delete(type)
        unsubs.delete(type)
      }
      unsubs.set(type, unsub)
      return unsub
    },
    sendRaw: (obj: unknown) => {
      sentRaw.push(obj)
    },
  },
}))

vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      post: vi.fn().mockResolvedValue({
        request_id: 'req-1',
        conversation_id: 'conv-1',
        model: 'mock',
      }),
    },
  }
})

function emit(type: string, payload: Record<string, unknown>) {
  handlers.get(type)?.(payload)
}

/** Start the generator (registers WS handlers) and drive it to completion. */
async function drive(
  gen: AsyncGenerator<string>,
): Promise<{ it: AsyncIterator<string>; first: Promise<IteratorResult<string>> }> {
  const it = gen[Symbol.asyncIterator]()
  const first = it.next()
  await new Promise((r) => setTimeout(r, 20))
  return { it, first }
}

async function drain(
  first: Promise<IteratorResult<string>>,
  it: AsyncIterator<string>,
): Promise<string> {
  let out = ''
  let r = await first
  while (!r.done) {
    out += r.value
    r = await it.next()
  }
  return out
}

beforeEach(() => {
  handlers.clear()
  unsubs.clear()
  sentRaw.length = 0
  vi.clearAllMocks()
})

afterEach(() => {
  unsubs.forEach((u) => u())
  vi.restoreAllMocks()
})

describe('streamChat', () => {
  it('posts a chat request and streams tokens from WS chunks', async () => {
    const { it, first } = await drive(
      streamChat({ conversationId: 'conv-1', prompt: 'hello', requestId: 'req-1' }),
    )

    emit('chat.chunk', { request_id: 'req-1', text: 'Good' })
    emit('chat.chunk', { request_id: 'req-1', text: ' morning' })
    emit('chat.end', { request_id: 'req-1', conversation_id: 'conv-1' })

    expect(await drain(first, it)).toBe('Good morning')
    expect(api.post).toHaveBeenCalledWith('/chat', {
      message: 'hello',
      conversation_id: 'conv-1',
      request_id: 'req-1',
    })
  })

  it('ignores chunks from other requests', async () => {
    const { it, first } = await drive(
      streamChat({ conversationId: 'conv-1', prompt: 'hi', requestId: 'req-1' }),
    )

    emit('chat.chunk', { request_id: 'other', text: 'wrong' })
    emit('chat.chunk', { request_id: 'req-1', text: 'right' })
    emit('chat.end', { request_id: 'req-1', conversation_id: 'conv-1' })

    expect(await drain(first, it)).toBe('right')
  })

  it('sends chat.cancel on abort', async () => {
    const ctrl = new AbortController()
    const { it, first } = await drive(
      streamChat({
        conversationId: 'conv-1',
        prompt: 'hello',
        requestId: 'req-1',
        signal: ctrl.signal,
      }),
    )
    emit('chat.chunk', { request_id: 'req-1', text: 'part' })

    ctrl.abort()
    await new Promise((r) => setTimeout(r, 20))

    expect(sentRaw).toEqual([
      { version: 1, type: 'chat.cancel', payload: { request_id: 'req-1' } },
    ])
    expect(await drain(first, it)).toBe('part')
  })
})