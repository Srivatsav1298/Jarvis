import { motion } from 'framer-motion'

export function RingGauge({
  value,
  size = 72,
  stroke = 5,
  color = '#A7E3FF',
  label,
  sublabel,
}: {
  value: number
  size?: number
  stroke?: number
  color?: string
  label?: string
  sublabel?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, value))
  const radius = c * (1 - pct)

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: radius }}
          transition={{ type: 'spring', stiffness: 90, damping: 20 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[13px] font-semibold text-soft-white">{label}</span>
        {sublabel && <span className="text-[9px] uppercase tracking-wider text-muted">{sublabel}</span>}
      </div>
    </div>
  )
}

export function Gauge({
  value,
  size = 130,
  stroke = 7,
  color = '#A7E3FF',
  label,
  min = 0,
  max = 100,
}: {
  value: number
  size?: number
  stroke?: number
  color?: string
  label?: string
  min?: number
  max?: number
}) {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const r = (size - stroke) / 2
  const arc = Math.PI * 0.8
  const start = Math.PI * 0.1
  const c = 2 * Math.PI * r
  const length = (arc / (2 * Math.PI)) * c

  const polar = (angle: number) => ({
    x: size / 2 + r * Math.cos(angle),
    y: size / 2 + r * Math.sin(angle),
  })

  const s = polar(start)
  const e = polar(start + arc)

  return (
    <div className="relative" style={{ width: size, height: size * 0.58 }}>
      <svg width={size} height={size} className="overflow-visible">
        <path
          d={`M ${s.x} ${s.y} A ${r} ${r} 0 0 1 ${e.x} ${e.y}`}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <motion.path
          d={`M ${s.x} ${s.y} A ${r} ${r} 0 0 1 ${e.x} ${e.y}`}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={length}
          initial={{ strokeDashoffset: length }}
          animate={{ strokeDashoffset: length * (1 - pct) }}
          transition={{ type: 'spring', stiffness: 80, damping: 18 }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="font-mono text-xl font-semibold leading-none text-soft-white">
          {label}
        </span>
      </div>
    </div>
  )
}

export function Bars({
  data,
  color = 'rgba(167,227,255,0.7)',
  className,
}: {
  data: number[]
  color?: string
  className?: string
}) {
  const max = Math.max(...data, 1)
  return (
    <div className={`flex h-8 items-end gap-[2px] ${className ?? ''}`} aria-hidden>
      {data.map((v, i) => (
        <motion.span
          key={i}
          className="w-full rounded-sm"
          style={{ background: color, opacity: 0.35 + (v / max) * 0.65 }}
          initial={{ height: '20%' }}
          animate={{ height: `${Math.max(10, (v / max) * 100)}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}
