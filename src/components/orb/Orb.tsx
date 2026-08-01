import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useInViewport } from '@/hooks/useInViewport'
import { useIsTabActive } from '@/hooks/useInterval'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useInterval } from '@/hooks/useInterval'
import { useOrbStore } from '@/stores/orbStore'
import { useMetricsStore } from '@/stores/metricsStore'
import { presenceFor } from '@/services/presence'
import { OrbCanvas } from './OrbCanvas'
import { OrbOverlay } from './OrbOverlay'
import { cn } from '@/utils/cn'

export function Orb({
  className,
  compact = false,
}: {
  className?: string
  compact?: boolean
}) {
  const [ref, inView] = useInViewport<HTMLDivElement>()
  const tabActive = useIsTabActive()
  const reduced = useReducedMotion()
  const mode = useOrbStore((s) => s.mode)
  const presenceMode = useOrbStore((s) => s.presence)
  const metrics = useMetricsStore()
  const [salt, setSalt] = useState(0)

  useInterval(() => setSalt((v) => v + 1), 9000)

  const active = inView && tabActive
  const presence = presenceFor(presenceMode, salt)
  const cpu = Math.round(metrics.cpu)
  const latency = Math.round(metrics.network.latencyMs)

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={cn('relative select-none', className)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key="scene"
          className="relative aspect-square w-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_38%,rgba(167,227,255,0.07),transparent_62%)]" />
          <OrbCanvas active={active} reducedMotion={reduced} />
          <OrbOverlay
            mode={mode}
            presence={presence}
            compact={compact}
            stats={[{ label: 'CPU', value: `${cpu}%` }, { label: 'LAT', value: `${latency}ms` }]}
          />
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
