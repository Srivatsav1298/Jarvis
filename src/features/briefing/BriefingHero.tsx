import { motion } from 'framer-motion'
import { buildBriefing } from '@/services/briefing'
import { Badge, Button, Icon, ProgressRing } from '@/components/ui'
import { useChatStore } from '@/stores/chatStore'
import { useNavigate } from 'react-router-dom'
import { pct } from '@/utils/format'
import { audioService } from '@/services/audio'

const PRIORITY_TONE = { high: 'accent', medium: 'warn', low: 'neutral' } as const

export function BriefingHero() {
  const briefing = buildBriefing()
  const sendMessage = useChatStore((s) => s.sendMessage)
  const navigate = useNavigate()

  const continueTask = async () => {
    audioService.play('activate')
    navigate('/assistant')
    window.setTimeout(() => {
      void sendMessage(
        'Continue the recommended focus: Complete Portfolio Website. What are the next three steps?',
      )
    }, 120)
  }

  return (
    <div className="glass-raised relative overflow-hidden rounded-card p-5 sm:p-6">
      <div className="ambient-vignette pointer-events-none absolute inset-0" />

      <div className="relative">
        <div className="mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
            <Icon name="sparkles" className="size-3.5" />
            AI Briefing
          </span>
          <span className="font-mono text-[11px] text-muted">{briefing.dateLine}</span>
        </div>

        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-[26px] font-bold leading-tight tracking-tight text-soft-white sm:text-[32px]"
        >
          {briefing.salutation}, Sir.
        </motion.h2>
        <p className="mt-1 text-[13px] text-muted">
          I've prepared today's overview while you were away.
        </p>

        <div className="mt-5 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          <div className="grid gap-1.5">
            {briefing.items.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.05, duration: 0.4 }}
                className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-white/[0.03]"
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-full border border-ok/25 bg-ok/10 text-ok">
                  <Icon name="check" className="size-3.5" />
                </span>
                <span className="flex-1 text-[13px] text-silver">{item.text}</span>
                <span className="font-mono text-[10px] text-muted">{item.time}</span>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.45 }}
            className="flex flex-col justify-between gap-4 rounded-2xl border border-white/[0.06] bg-graphite/50 p-4"
          >
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                Recommended Focus
              </p>
              <div className="mt-2 flex items-center gap-3">
                <ProgressRing value={briefing.focus.progress} size={54} tone="accent">
                  <span className="font-mono text-[10px] text-soft-white">
                    {Math.round(briefing.focus.progress * 100)}
                  </span>
                </ProgressRing>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-soft-white">
                    {briefing.focus.title}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge tone={PRIORITY_TONE[briefing.focus.priority]}>
                      {briefing.focus.priority}
                    </Badge>
                    <span className="text-[11px] text-muted">{briefing.focus.eta} remaining</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[15px] font-semibold text-soft-white">
                  {pct(briefing.productivity)}
                </span>
                <span className="text-[11px] leading-tight text-muted">estimated productivity</span>
              </div>
              <Button variant="primary" size="md" onClick={continueTask}>
                {briefing.primaryAction}
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
