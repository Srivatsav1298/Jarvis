import { motion } from 'framer-motion'
import { StatusChip, StatusDot } from '@/components/ui'

const MODE_LABEL: Record<string, string> = {
  idle: 'Idle',
  monitoring: 'Monitoring',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  processing: 'Processing',
  completed: 'Completed',
}

const MODE_TONE: Record<string, 'neutral' | 'accent' | 'active' | 'ok' | 'warn'> = {
  idle: 'neutral',
  monitoring: 'active',
  listening: 'accent',
  thinking: 'accent',
  speaking: 'accent',
  processing: 'accent',
  completed: 'ok',
}

export function OrbOverlay({
  mode,
  presence,
  stats,
  compact = false,
}: {
  mode: string
  presence: string
  stats?: { label: string; value: string }[]
  compact?: boolean
}) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between py-[6%]">
      <div className="flex w-full items-center justify-between px-[8%]">
        <StatusChip tone={MODE_TONE[mode] ?? 'neutral'} pulse={mode !== 'idle'}>
          {MODE_LABEL[mode] ?? mode}
        </StatusChip>
        {!compact && (
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-silver">
            <StatusDot tone="ok" />
            Engine nominal
          </span>
        )}
      </div>

      <div className="glass-subtle w-[72%] rounded-2xl px-4 py-2.5 text-center shadow-panel">
        <motion.p
          key={presence}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="text-[12px] font-medium tracking-tight text-soft-white"
        >
          {presence}
        </motion.p>
      </div>

      {!compact && stats && (
        <div className="flex items-center gap-3">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-mono text-[12px] font-medium text-silver">{s.value}</p>
              <p className="text-[9px] uppercase tracking-[0.14em] text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
