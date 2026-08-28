import { create } from 'zustand'
import type { MetricKey, Metrics } from '@/types'
import type { SystemMetrics } from '@/types/api'
import { noiseWalk, random } from '@/utils/random'
import { api } from '@/services/api'
import { socket } from '@/services/ws'
import { SYSTEM_METRICS } from '@/services/events'

export const HISTORY_LEN = 60
export const STORAGE_TOTAL_GB = 1024

function seedHistory(value: number): number[] {
  return Array.from({ length: HISTORY_LEN }, () => value)
}

const initialState: Metrics = {
  cpu: 34,
  ram: 58,
  gpu: 21,
  battery: 82,
  batteryCharging: true,
  storageUsed: 312,
  storageTotal: STORAGE_TOTAL_GB,
  temperature: 47,
  network: {
    connected: true,
    type: 'wifi',
    downMbps: 142,
    upMbps: 38,
    latencyMs: 9,
    ssid: 'StarcNet-5G',
  },
  mic: { active: false, level: 0 },
  camera: { active: false, level: 0 },
  location: { active: true, city: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  history: {
    cpu: seedHistory(34),
    ram: seedHistory(58),
    gpu: seedHistory(21),
    temp: seedHistory(47),
    latency: seedHistory(9),
    netDown: seedHistory(142),
  },
  engine: {
    model: 'STARC-N2',
    temp: 61,
    load: 27,
    uptime: 0,
    tokensToday: 18240,
  },
}

const KEYS: MetricKey[] = ['cpu', 'ram', 'gpu', 'temp', 'latency', 'netDown']

/** Append a value into a history ring, trimming to HISTORY_LEN. */
function pushHistory(history: Metrics['history'], key: MetricKey, value: number): void {
  history[key] = [...history[key].slice(-(HISTORY_LEN - 1)), value]
}

/** Map a live backend SystemMetrics into a Metrics diff + updated history. */
function applySystemMetrics(
  prev: Metrics,
  live: SystemMetrics,
  apiLatencyMs: number | null,
): Metrics {
  const gpu = live.gpu?.percent ?? prev.gpu
  const temperature = live.temp?.c ?? prev.temperature
  const latency = live.network.latency_ms ?? (apiLatencyMs ?? prev.network.latencyMs)

  const history: Metrics['history'] = {
    cpu: [...prev.history.cpu],
    ram: [...prev.history.ram],
    gpu: [...prev.history.gpu],
    temp: [...prev.history.temp],
    latency: [...prev.history.latency],
    netDown: [...prev.history.netDown],
  }
  pushHistory(history, 'cpu', live.cpu_percent)
  pushHistory(history, 'ram', live.ram_percent)
  pushHistory(history, 'gpu', gpu)
  pushHistory(history, 'temp', temperature)
  pushHistory(history, 'latency', latency)
  pushHistory(history, 'netDown', live.network.down_mbps)

  return {
    ...prev,
    cpu: live.cpu_percent,
    ram: live.ram_percent,
    gpu,
    temperature,
    battery: live.battery?.percent ?? prev.battery,
    batteryCharging: live.battery?.charging ?? prev.batteryCharging,
    storageUsed: live.storage_used_gb,
    storageTotal: live.storage_total_gb,
    network: {
      connected: live.network.connected,
      type: live.network.type === 'wifi' ? 'wifi' : 'ethernet',
      downMbps: live.network.down_mbps,
      upMbps: live.network.up_mbps,
      latencyMs: latency,
      ssid: live.network.ssid ?? prev.network.ssid,
    },
    history,
  }
}

function evolve(prev: Metrics): Metrics {
  const cpu = noiseWalk(prev.cpu, random(18, 55), random(0.6, 1.6))
  const ram = noiseWalk(prev.ram, random(50, 66), 0.4)
  const gpu = noiseWalk(prev.gpu, random(12, 30), 1.2)
  const temp = noiseWalk(prev.temperature, 46 + (cpu / 100) * 14 + (gpu / 100) * 6, 0.4)
  const latency = noiseWalk(prev.network.latencyMs, random(6, 22), random(0.3, 1))
  const netDown = noiseWalk(prev.network.downMbps, random(60, 380), random(6, 24))
  const upMbps = noiseWalk(prev.network.upMbps, random(18, 90), random(2, 8))
  const engineLoad = noiseWalk(prev.engine.load, random(18, 40), 1.5)
  const engineTemp = noiseWalk(prev.engine.temp, 58 + engineLoad * 0.25, 0.3)

  const mic = prev.mic.active
    ? {
        active: true,
        level: Math.max(
          0.04,
          Math.min(1, noiseWalk(prev.mic.level, random(0.1, 0.9), 0.12)),
        ),
      }
    : { active: false, level: 0 }

  const battery = Math.max(
    0,
    Math.min(100, prev.battery + (prev.batteryCharging ? 0.02 : -0.01)),
  )

  const history: Metrics['history'] = { ...prev.history }
  KEYS.forEach((k) => {
    const val = currentValue(k, cpu, ram, gpu, temp, latency, netDown)
    pushHistory(history, k, val)
  })

  return {
    ...prev,
    cpu,
    ram,
    gpu,
    temperature: temp,
    battery,
    mic,
    network: { ...prev.network, downMbps: netDown, upMbps, latencyMs: latency },
    engine: {
      ...prev.engine,
      load: engineLoad,
      temp: engineTemp,
      uptime: prev.engine.uptime + 1,
    },
    history,
  }
}

function currentValue(
  key: MetricKey,
  cpu: number,
  ram: number,
  gpu: number,
  temp: number,
  latency: number,
  netDown: number,
): number {
  switch (key) {
    case 'cpu':
      return cpu
    case 'ram':
      return ram
    case 'gpu':
      return gpu
    case 'temp':
      return temp
    case 'latency':
      return latency
    case 'netDown':
      return netDown
  }
}

interface MetricsState extends Metrics {
  running: boolean
  live: boolean
  tick: () => void
  start: () => void
  stop: () => void
  refresh: () => Promise<void>
  setMic: (active: boolean, level?: number) => void
  setCamera: (active: boolean, level?: number) => void
}

let simId: number | null = null
let pollId: number | null = null
let cleanupLive: (() => void) | null = null

export const useMetricsStore = create<MetricsState>()((set, get) => ({
  ...initialState,
  running: false,
  live: false,

  tick: () => set(evolve(get())),

  refresh: async () => {
    try {
      const live = await api.get<SystemMetrics>('/system/metrics')
      set((s) => applySystemMetrics(s, live, live.api_latency_ms))
    } catch {
      // fall back to simulation if the API is unreachable
    }
  },

  start: () => {
    if (get().running) return
    set({ running: true })

    cleanupLive = socket.subscribe(SYSTEM_METRICS, (payload) => {
      const p = payload as unknown as { metrics?: SystemMetrics }
      const live = p.metrics ?? (payload as unknown as SystemMetrics)
      if (live && typeof live.cpu_percent === 'number') {
        set((s) => applySystemMetrics(s, live, live.api_latency_ms))
        set({ live: true })
      }
    })

    void get().refresh()
    simId = window.setInterval(() => get().tick(), 1000)

    // Fall back to polling the API every second when the WS is closed.
    const checkWss = () => {
      if (socket.status === 'open') {
        if (pollId !== null) {
          window.clearInterval(pollId)
          pollId = null
        }
      } else if (pollId === null) {
        pollId = window.setInterval(() => void get().refresh(), 1000)
      }
    }
    checkWss()
    pollId ??= window.setInterval(checkWss, 1000)
  },

  stop: () => {
    if (simId !== null) {
      window.clearInterval(simId)
      simId = null
    }
    if (pollId !== null) {
      window.clearInterval(pollId)
      pollId = null
    }
    cleanupLive?.()
    cleanupLive = null
    set({ running: false, live: false })
  },

  setMic: (active, level = 0) => set({ mic: { active, level } }),
  setCamera: (active, level = 0) => set({ camera: { active, level } }),
}))