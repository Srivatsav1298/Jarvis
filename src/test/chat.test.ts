import { describe, expect, it } from 'vitest'
import { chatService } from '@/services/chat'

async function collect(gen: AsyncGenerator<string>): Promise<string> {
  let out = ''
  for await (const token of gen) out += token
  return out
}

describe('chatService', () => {
  it('streams a tokenized reply for a known prompt', async () => {
    const ctrl = new AbortController()
    const reply = await collect(chatService.stream('thanks', ctrl.signal))
    expect(reply.length).toBeGreaterThan(20)
    expect(reply).toContain('Always, Sir.')
  })

  it('produces markdown and code blocks for code prompts', async () => {
    const ctrl = new AbortController()
    const reply = await collect(chatService.stream('write a react component', ctrl.signal))
    expect(reply).toContain('```')
    expect(reply.toLowerCase()).toContain('implementation')
  }, 20_000)

  it('aborts before streaming throws AbortError', async () => {
    const ctrl = new AbortController()
    ctrl.abort()
    const gen = chatService.stream('hello', ctrl.signal)
    await expect(collect(gen)).rejects.toThrow('Aborted')
  })

  it('aborts mid-stream', async () => {
    const ctrl = new AbortController()
    const gen = chatService.stream('hello there', ctrl.signal)
    const it = gen[Symbol.asyncIterator]()
    const first = await it.next()
    expect(first.done).toBe(false)
    ctrl.abort()
    await expect(it.next()).rejects.toThrow('Aborted')
  }, 10_000)
})
