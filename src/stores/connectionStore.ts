import { create } from 'zustand'
import type { WsStatus } from '@/services/ws'

interface ConnectionState {
  api: 'ok' | 'error'
  ws: WsStatus
  latency: number | null
  reconnectCount: number
  lastPingAt: number | null
  setWsStatus: (ws: WsStatus) => void
  setLatency: (latency: number | null) => void
  setApiStatus: (api: 'ok' | 'error') => void
  setReconnectCount: (reconnectCount: number) => void
}

export const useConnectionStore = create<ConnectionState>()((set) => ({
  api: 'ok',
  ws: 'idle',
  latency: null,
  reconnectCount: 0,
  lastPingAt: null,
  setWsStatus: (ws) => set({ ws }),
  setLatency: (latency) => set({ latency }),
  setApiStatus: (api) => set({ api }),
  setReconnectCount: (reconnectCount) => set({ reconnectCount }),
}))