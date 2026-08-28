import { describe, expect, it, vi, beforeEach } from 'vitest'
import { HISTORY_LEN, useMetricsStore } from '@/stores/metricsStore'
import type { SystemMetrics } from '@/types/api'

describe('metricsStore', () => {
  it('tick evolves values within sane bounds', () => {
    const { tick, cpu, ram, gpu } = useMetricsStore.getState()
    tick()
    const s = useMetricsStore.getState()
    expect(s.cpu).toBeGreaterThanOrEqual(0)
    expect(s.cpu).toBeLessThanOrEqual(100)
    expect(s.ram).toBeGreaterThanOrEqual(0)
    expect(s.ram).toBeLessThanOrEqual(100)
    void cpu
    void ram
    void gpu
  })

  it('keeps history ring buffers at fixed length', () => {
    const before = useMetricsStore.getState().history.cpu.length
    useMetricsStore.getState().tick()
    useMetricsStore.getState().tick()
    const s = useMetricsStore.getState()
    expect(s.history.cpu.length).toBe(before)
    expect(s.history.cpu.length).toBe(HISTORY_LEN)
    expect(s.history.ram.length).toBe(HISTORY_LEN)
    expect(s.history.gpu.length).toBe(HISTORY_LEN)
  })

  it('increments engine uptime each tick', () => {
    const uptime = useMetricsStore.getState().engine.uptime
    useMetricsStore.getState().tick()
    expect(useMetricsStore.getState().engine.uptime).toBe(uptime + 1)
  })

  it('start/stop manages the running flag', () => {
    const { start, stop } = useMetricsStore.getState()
    start()
    expect(useMetricsStore.getState().running).toBe(true)
    stop()
    expect(useMetricsStore.getState().running).toBe(false)
    stop()
    expect(useMetricsStore.getState().running).toBe(false)
  })

  it('toggles mic and camera sensors', () => {
    const { setMic, setCamera } = useMetricsStore.getState()
    setMic(true, 0.4)
    expect(useMetricsStore.getState().mic).toEqual({ active: true, level: 0.4 })
    setCamera(false)
    expect(useMetricsStore.getState().camera.active).toBe(false)
  })
})

const liveSample: SystemMetrics = {
  cpu_percent: 41,
  cpu_count: 8,
  ram_percent: 63,
  ram_used_gb: 9.2,
  ram_total_gb: 16,
  storage_percent: 52,
  storage_used_gb: 312.4,
  storage_total_gb: 1024,
  battery: { percent: 88, charging: true, present: true },
  gpu: null,
  temp: null,
  network: {
    connected: true,
    type: 'wifi',
    down_mbps: 204.5,
    up_mbps: 41.2,
    latency_ms: 6,
    ssid: 'RealNet-5G',
  },
  api_latency_ms: 3,
  collected_at: '2026-08-04T00:00:00Z',
}

describe('metricsStore live integration', () => {
  beforeEach(() => {
    useMetricsStore.getState().stop()
    useMetricsStore.setState({
      cpu: 34,
      ram: 58,
      gpu: 21,
      storageUsed: 312,
      battery: 82,
      batteryCharging: true,
      network: {
        connected: true,
        type: 'wifi',
        downMbps: 142,
        upMbps: 38,
        latencyMs: 9,
        ssid: 'StarcNet-5G',
      },
      history: {
        cpu: Array(HISTORY_LEN).fill(34),
        ram: Array(HISTORY_LEN).fill(58),
        gpu: Array(HISTORY_LEN).fill(21),
        temp: Array(HISTORY_LEN).fill(47),
        latency: Array(HISTORY_LEN).fill(9),
        netDown: Array(HISTORY_LEN).fill(142),
      },
    })
  })

  it('refresh() backfills a snapshot from the API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, data: liveSample }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )
    await useMetricsStore.getState().refresh()
    const s = useMetricsStore.getState()
    expect(s.cpu).toBe(41)
    expect(s.ram).toBe(63)
    expect(s.network.downMbps).toBe(204.5)
    expect(s.network.ssid).toBe('RealNet-5G')
    expect(s.battery).toBe(88)
    expect(s.history.cpu.at(-1)).toBe(41)
    expect(s.history.cpu.length).toBe(HISTORY_LEN)
  })

  it('keeps history at fixed length after refresh', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, data: liveSample }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )
    await useMetricsStore.getState().refresh()
    await useMetricsStore.getState().refresh()
    const s = useMetricsStore.getState()
    expect(s.history.cpu.length).toBe(HISTORY_LEN)
    expect(s.history.ram.length).toBe(HISTORY_LEN)
    expect(s.history.gpu.length).toBe(HISTORY_LEN)
  })

  it('marks live=false on stop', () => {
    useMetricsStore.getState().start()
    expect(useMetricsStore.getState().running).toBe(true)
    useMetricsStore.getState().stop()
    expect(useMetricsStore.getState().running).toBe(false)
  })
})
