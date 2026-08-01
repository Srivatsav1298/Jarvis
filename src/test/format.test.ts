import { describe, expect, it } from 'vitest'
import {
  clamp,
  clockNow,
  formatBytes,
  formatUptime,
  greeting,
  pad,
  pct,
  relativeTime,
} from '@/utils/format'

describe('format', () => {
  it('pads numbers to two digits', () => {
    expect(pad(0)).toBe('00')
    expect(pad(7)).toBe('07')
    expect(pad(42)).toBe('42')
  })

  it('formats clock time', () => {
    expect(clockNow(new Date(2026, 0, 1, 9, 5))).toBe('09:05')
  })

  it('greets by time of day', () => {
    expect(greeting(new Date(2026, 0, 1, 9))).toBe('Good Morning')
    expect(greeting(new Date(2026, 0, 1, 14))).toBe('Good Afternoon')
    expect(greeting(new Date(2026, 0, 1, 19))).toBe('Good Evening')
    expect(greeting(new Date(2026, 0, 1, 23))).toBe('Good Night')
  })

  it('formats relative time', () => {
    expect(relativeTime(Date.now() - 5_000)).toMatch(/s ago/)
    expect(relativeTime(Date.now() - 5 * 60_000)).toMatch(/m ago/)
    expect(relativeTime(Date.now() - 3 * 3_600_000)).toMatch(/h ago/)
    expect(relativeTime(Date.now() - 3 * 86_400_000)).toMatch(/d ago/)
  })

  it('formats bytes with sensible units', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1_024)).toBe('1.0 KB')
    expect(formatBytes(1_024 * 1_024)).toBe('1.0 MB')
    expect(formatBytes(5 * 1_024 * 1_024 * 1_024)).toBe('5.0 GB')
  })

  it('formats uptime', () => {
    expect(formatUptime(0)).toBe('0m')
    expect(formatUptime(45 * 60)).toBe('45m')
    expect(formatUptime(2 * 3_600 + 5 * 60)).toBe('2h 5m')
  })

  it('clamps values', () => {
    expect(clamp(120, 0, 100)).toBe(100)
    expect(clamp(-3, 0, 100)).toBe(0)
    expect(clamp(50, 0, 100)).toBe(50)
  })

  it('formats percentages', () => {
    expect(pct(0.45)).toBe('45%')
    expect(pct(1.2)).toBe('100%')
    expect(pct(-0.2)).toBe('0%')
  })
})
