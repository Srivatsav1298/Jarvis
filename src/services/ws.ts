import { MSG_PING, MSG_PONG, WS_V } from '@/services/events'

export type WsStatus =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'closed'
type Handler = (payload: Record<string, unknown>, raw: unknown) => void

const RECONNECT_MIN = 1000
export const RECONNECT_MAX = 30000
const HEARTBEAT_MS = 30_000

export class WsClient {
  ws: WebSocket | null = null
  private url = ''
  private wantOpen = false
  private _status: WsStatus = 'idle'
  private _reconnectCount = 0
  private _latencyMs: number | null = null
  private _lastPingAt: number | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private handlers = new Map<string, Set<Handler>>()

  get status() {
    return this._status
  }
  get reconnectCount() {
    return this._reconnectCount
  }
  get latencyMs() {
    return this._latencyMs
  }
  get lastPingAt() {
    return this._lastPingAt
  }

  connect(url = '/ws') {
    this.url = url
    this.wantOpen = true
    this.open()
  }

  close() {
    this.wantOpen = false
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.ws?.close()
  }

  subscribe(type: string, fn: Handler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set())
    this.handlers.get(type)!.add(fn)
    return () => this.handlers.get(type)?.delete(fn)
  }

  sendRaw(obj: unknown) {
    this.ws?.send(JSON.stringify(obj))
  }

  sendPing() {
    const ts = Date.now()
    this.sendRaw({ version: WS_V, type: MSG_PING, payload: { ts } })
    this._lastPingAt = ts
  }

  private open() {
    this._status = this.wantOpen ? 'connecting' : 'closed'
    const ws = new WebSocket(this.url)
    this.ws = ws
    ws.onopen = () => {
      this._status = 'open'
      this.sendPing()
      if (this.timer) clearInterval(this.timer)
      this.timer = setInterval(() => this.sendPing(), HEARTBEAT_MS)
    }
    ws.onmessage = (ev) => {
      let msg: { type?: string; payload?: Record<string, unknown> }
      try {
        msg = JSON.parse(ev.data as string)
      } catch {
        return
      }
      if (msg.type === MSG_PONG) this._onPong(msg.payload)
      if (msg.type) this.handlers.get(msg.type)?.forEach((h) => h(msg.payload ?? {}, msg))
    }
    ws.onclose = () => {
      if (this.timer) {
        clearInterval(this.timer)
        this.timer = null
      }
      if (!this.wantOpen) {
        this._status = 'closed'
        return
      }
      this._status = 'reconnecting'
      this._reconnectCount += 1
      const delay = Math.min(RECONNECT_MAX, RECONNECT_MIN * 2 ** this._reconnectCount)
      setTimeout(() => {
        if (this.wantOpen) this.open()
      }, delay)
    }
  }

  private _onPong(payload?: { ts?: number }) {
    if (payload?.ts != null) {
      this._latencyMs = Date.now() - payload.ts
      this._lastPingAt = Date.now()
    }
  }
}

export const socket = new WsClient()