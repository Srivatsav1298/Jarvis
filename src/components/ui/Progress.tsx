import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'

export function ProgressBar({
  value,
  className,
  trackClassName,
  tone = 'default',
}: {
  value: number
  className?: string
  trackClassName?: string
  tone?: 'default' | 'accent' | 'ok' | 'warn' | 'danger'
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  const tones = {
    default: 'bg-silver/80',
    accent: 'bg-accent',
    ok: 'bg-ok',
    warn: 'bg-warn',
    danger: 'bg-danger',
  }
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-1 w-full overflow-hidden rounded-full bg-white/[0.08]', className, trackClassName)}
    >
      <motion.div
        className={cn('h-full rounded-full', tones[tone])}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 22 }}
      />
    </div>
  )
}

export function ProgressRing({
  value,
  size = 56,
  stroke = 5,
  children,
  tone = 'accent',
  className,
}: {
  value: number
  size?: number
  stroke?: number
  children?: React.ReactNode
  tone?: 'accent' | 'silver' | 'ok' | 'warn'
  className?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, value))
  const colors = {
    accent: 'stroke-accent',
    silver: 'stroke-silver',
    ok: 'stroke-ok',
    warn: 'stroke-warn',
  }
  return (
    <div
      className={cn('relative inline-grid place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeLinecap="round"
          strokeWidth={stroke}
          className={colors[tone]}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ type: 'spring', stiffness: 90, damping: 20 }}
          strokeDasharray={c}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}
