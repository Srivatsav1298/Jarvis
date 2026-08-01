import { describe, expect, it } from 'vitest'
import { HISTORY_LEN, useMetricsStore } from '@/stores/metricsStore'

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
