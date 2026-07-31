export function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

export function clockNow(date = new Date()): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fullDate(date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function shortDate(date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function timeOfDay(date = new Date()): string {
  const h = date.getHours()
  if (h < 5) return 'night'
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  if (h < 21) return 'evening'
  return 'night'
}

export function greeting(date = new Date()): string {
  const t = timeOfDay(date)
  return {
    morning: 'Good Morning',
    afternoon: 'Good Afternoon',
    evening: 'Good Evening',
    night: 'Good Night',
  }[t]
}

export function relativeTime(ts: number): string {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return `${d}d ago`
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

export function formatSalary(min: number, max: number, currency = '$'): string {
  const f = (n: number) =>
    `${currency}${Math.round(n / 1000)}k`.replace(/\$/g, currency === '$' ? '$' : currency)
  return `${f(min)} – ${f(max)}`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function pct(value: number): string {
  return `${Math.round(clamp(value, 0, 1) * 100)}%`
}
