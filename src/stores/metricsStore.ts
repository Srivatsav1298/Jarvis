import { create } from 'zustand'
import type { MetricKey, Metrics } from '@/types'
import { noiseWalk, random } from '@/utils/random'

export const HISTORY_LEN = 60

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
  storageTotal: 1024,
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

  const history = Object.fromEntries(
    KEYS.map((k) => {
      const val = currentValue(k, cpu, ram, gpu, temp, latency, netDown)
      return [k, [...prev.history[k].slice(-(HISTORY_LEN - 1)), val]]
    }),
  ) as Record<MetricKey, number[]>

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

interface MetricsState extends Metrics {
  running: boolean
  tick: () => void
  start: () => void
  stop: () => void
  setMic: (active: boolean, level?: number) => void
  setCamera: (active: boolean, level?: number) => void
}

let intervalId: number | null = null

export const useMetricsStore = create<MetricsState>()((set, get) => ({
  ...initialState,
  running: false,

  tick: () => set(evolve(get())),

  start: () => {
    if (get().running) return
    set({ running: true })
    intervalId = window.setInterval(() => get().tick(), 1000)
  },

  stop: () => {
    if (intervalId !== null) {
      window.clearInterval(intervalId)
      intervalId = null
    }
    set({ running: false })
  },

  setMic: (active, level = 0) => set((s) => ({ mic: { active, level } })),
  setCamera: (active, level = 0) => set((s) => ({ camera: { active, level } })),
}))
