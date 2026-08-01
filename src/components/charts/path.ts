export interface Pt {
  x: number
  y: number
}

/** Builds a smooth SVG path through points using Catmull-Rom → cubic Bézier. */
export function smoothPath(pts: Pt[]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`

  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(
      2,
    )}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return d
}

export function toPoints(
  data: number[],
  width: number,
  height: number,
  pad = 2,
  min?: number,
  max?: number,
): Pt[] {
  if (data.length === 0) return []
  const lo = min ?? Math.min(...data)
  const hi = max ?? Math.max(...data)
  const span = Math.max(1e-6, hi - lo)
  const innerW = width - pad * 2
  const innerH = height - pad * 2
  return data.map((v, i) => ({
    x: pad + (i / Math.max(1, data.length - 1)) * innerW,
    y: pad + innerH - ((v - lo) / span) * innerH,
  }))
}

export function areaPath(pts: Pt[], height: number): string {
  if (pts.length === 0) return ''
  const line = smoothPath(pts)
  const last = pts[pts.length - 1]
  const first = pts[0]
  return `${line} L ${last.x.toFixed(2)} ${height} L ${first.x.toFixed(2)} ${height} Z`
}
