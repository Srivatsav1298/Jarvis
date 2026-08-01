import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon, ProgressBar } from '@/components/ui'
import { useInterval } from '@/hooks/useInterval'
import { useOrbStore, intensityFor } from '@/stores/orbStore'
import type { OrbMode } from '@/types'

interface Activity {
  kind: OrbMode
  headline: string
  detail: string
  progress: number
  eta: string
  icon: string
}

const ACTIVITIES: Activity[] = [
  { kind: 'processing', headline: 'Scanning the job market', detail: '4 boards · matching your profile', progress: 0.68, eta: '~4m', icon: 'briefcase' },
  { kind: 'monitoring', headline: 'Summarizing inbox', detail: '3 important emails flagged', progress: 0.82, eta: '~1m', icon: 'email' },
  { kind: 'thinking', headline: 'Optimizing your calendar', detail: 'Protecting a 3h focus block', progress: 0.55, eta: '~2m', icon: 'calendar' },
  { kind: 'processing', headline: 'Indexing intelligence feed', detail: '12 new articles ranked by relevance', progress: 0.91, eta: '~30s', icon: 'newspaper' },
]

export function ActivityCard() {
  const setMode = useOrbStore((s) => s.setMode)
  const [idx, setIdx] = useState(0)
  const [progress, setProgress] = useState(ACTIVITIES[0].progress)
  const activity = ACTIVITIES[idx]

  useEffect(() => {
    setMode(activity.kind)
  }, [activity.kind, setMode])

  useInterval(() => {
    setIdx((i) => (i + 1) % ACTIVITIES.length)
  }, 7000)

  useEffect(() => {
    setProgress(activity.progress)
    const timer = window.setInterval(() => {
      setProgress((p) => Math.min(1, p + 0.02))
    }, 160)
    return () => window.clearInterval(timer)
  }, [activity])

  const tone = intensityFor(activity.kind)

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-graphite/50 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
        Current Activity
      </p>

      <div className="mt-3 flex min-h-[52px] items-center gap-3">
        <motion.span
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-accent/20 bg-accent/10 text-accent"
        >
          <Icon name={activity.icon} className="size-5" />
        </motion.span>
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activity.headline}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
            >
              <p className="truncate text-[13px] font-semibold text-soft-white">{activity.headline}</p>
              <p className="mt-0.5 truncate text-[11px] text-muted">
                {activity.detail} · ETA {activity.eta}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
        <span className="font-mono text-[12px] text-accent">{Math.round(progress * 100)}%</span>
      </div>

      <div className="mt-3">
        <ProgressBar
          value={progress}
          tone="accent"
          trackClassName="h-[3px]"
          className="h-[3px]"
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-[10px] text-muted">
        <span>Engine load {Math.round(tone * 100)}%</span>
        <span className="font-mono">STARC-N2</span>
      </div>
    </div>
  )
}
