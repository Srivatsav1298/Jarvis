import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { socket } from '@/services/ws'
import { useConnectionStore } from '@/stores/connectionStore'

class FakeWS {
  static instances: FakeWS[] = []
  readyState = 0
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  sent: string[] = []
  constructor() {
    FakeWS.instances.push(this)
  }
  send(d: string) {
    this.sent.push(d)
  }
  close() {}
  open() {
    this.readyState = 1
    this.onopen?.()
  }
  message(obj: unknown) {
    this.onmessage?.({ data: JSON.stringify(obj) })
  }
  closeConn() {
    this.onclose?.()
  }
}

beforeEach(() => {
  FakeWS.instances = []
  vi.useFakeTimers()
})

afterEach(() => {
  socket.close()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('connects, sends ping, computes latency from pong', () => {
  vi.stubGlobal('WebSocket', FakeWS)
  socket.connect('/ws')
  const ws = FakeWS.instances[0]
  ws.open()
  expect(socket.status).toBe('open')
  expect(socket.latencyMs).toBeNull()

  const ping = JSON.parse(ws.sent[0])
  expect(ping.type).toBe('ping')

  const pongTs = Date.now() - 12
  ws.message({ version: 1, type: 'pong', payload: { ts: pongTs } })
  expect(socket.latencyMs).toBeGreaterThanOrEqual(12)
  expect(socket.lastPingAt).not.toBeNull()
})

it('reconnects on close', () => {
  vi.stubGlobal('WebSocket', FakeWS)
  socket.connect('/ws')
  FakeWS.instances[0].open()
  FakeWS.instances[0].closeConn()
  expect(socket.status).toBe('reconnecting')
  expect(socket.reconnectCount).toBe(1)

  vi.advanceTimersByTime(2000)
  expect(FakeWS.instances.length).toBeGreaterThan(1)
})

it('exposes connectionStore setters', () => {
  const s = useConnectionStore.getState()
  s.setWsStatus('open')
  s.setLatency(7)
  s.setReconnectCount(2)
  expect(useConnectionStore.getState().ws).toBe('open')
  expect(useConnectionStore.getState().latency).toBe(7)
  expect(useConnectionStore.getState().reconnectCount).toBe(2)
})