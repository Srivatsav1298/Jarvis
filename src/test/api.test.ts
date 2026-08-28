import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '@/services/api'

const ok = (data: unknown, init: RequestInit = {}) =>
  new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
const bad = (status: number, code: string) =>
  new Response(
    JSON.stringify({ success: false, error: { status, code, title: code } }),
    { status },
  )

describe('api', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('unwraps the success envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({ hello: 1 }))
    const data = await api.get<{ hello: number }>('/health/live')
    expect(data).toEqual({ hello: 1 })
  })

  it('throws ApiError on an error envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(bad(404, 'not_found'))
    await expect(api.get('/none')).rejects.toBeInstanceOf(ApiError)
  })

  it('retries a 503 then succeeds', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(bad(503, 'unavailable'))
      .mockResolvedValueOnce(ok({ ok: true }))
    expect(await api.get('/health/ready')).toEqual({ ok: true })
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('sends a JSON body on POST', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({ id: 1 }))
    await api.post('/chat/messages', { message: 'hi' })
    const [, init] = spy.mock.calls[0]
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({ 'content-type': 'application/json' })
    expect(init?.body).toBe(JSON.stringify({ message: 'hi' }))
  })
})