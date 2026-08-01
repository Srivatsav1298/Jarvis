import { useState } from 'react'
import { motion } from 'framer-motion'
import { PageContainer, PageHeader } from '@/features/shared/PageContainer'
import { AUTOMATIONS } from '@/services/automations'
import type { Automation, AutomationStatus } from '@/types'
import { Badge, Button, Icon } from '@/components/ui'
import { useOrbStore } from '@/stores/orbStore'
import { useUIStore } from '@/stores/uiStore'
import { cn } from '@/utils/cn'

const STATUS_TONE: Record<AutomationStatus, 'ok' | 'accent' | 'warn' | 'danger' | 'neutral'> = {
  running: 'ok',
  scheduled: 'accent',
  completed: 'neutral',
  paused: 'warn',
  error: 'danger',
}

const STATUS_LABEL: Record<AutomationStatus, string> = {
  running: 'Running',
  scheduled: 'Scheduled',
  completed: 'Completed',
  paused: 'Paused',
  error: 'Attention',
}

const CATEGORY_LABEL: Record<string, string> = {
  career: 'Career',
  email: 'Email',
  productivity: 'Productivity',
  intelligence: 'Intelligence',
  memory: 'Memory',
}

function AutomationCard({ automation, index }: { automation: Automation; index: number }) {
  const setOrbMode = useOrbStore((s) => s.setMode)
  const pushToast = useUIStore((s) => s.pushToast)
  const [status, setStatus] = useState(automation.status)
  const [running, setRunning] = useState(false)

  const runNow = () => {
    if (running) return
    setRunning(true)
    setStatus('running')
    setOrbMode('processing')
    pushToast({ title: `${automation.name} started`, message: automation.description.slice(0, 60) + '…', tone: 'info' })
    window.setTimeout(() => {
      setRunning(false)
      setStatus(automation.status === 'paused' ? 'paused' : 'completed')
      useOrbStore.getState().setMode('completed')
      pushToast({ title: `${automation.name} finished`, message: 'Results stored to your timeline.', tone: 'success' })
    }, 2200)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      className="glass flex flex-col rounded-card p-4"
    >
      <div className="flex items-start justify-between">
        <span className="grid size-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-silver">
          <Icon name={automation.icon} className="size-5" />
        </span>
        <Badge tone={STATUS_TONE[status]}>
          <span className={cn(status === 'running' && 'animate-pulse')}>{STATUS_LABEL[status]}</span>
        </Badge>
      </div>

      <h3 className="mt-3 text-[14px] font-semibold text-soft-white">{automation.name}</h3>
      <p className="mt-1 flex-1 text-[12px] leading-relaxed text-muted">{automation.description}</p>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Last run', value: automation.lastRun },
          { label: 'Next', value: automation.nextRun },
          { label: 'Runs', value: String(automation.runs) },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-white/[0.05] bg-white/[0.03] px-1 py-1.5">
            <p className="truncate font-mono text-[11px] font-medium text-silver">{s.value}</p>
            <p className="text-[8px] uppercase tracking-[0.14em] text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
        <Badge tone="neutral">{CATEGORY_LABEL[automation.category]}</Badge>
        <Button size="sm" variant="secondary" loading={running} onClick={runNow}>
          {running ? 'Running…' : 'Run now'}
        </Button>
      </div>
    </motion.div>
  )
}

export default function AutomationPage() {
  return (
    <PageContainer className="p-5 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1400px]">
        <PageHeader
          eyebrow="Automation"
          title="Background Agents"
          subtitle="7 automations watching your world · 5 active right now"
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {AUTOMATIONS.map((a, i) => (
            <AutomationCard key={a.id} automation={a} index={i} />
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-accent/15 bg-accent/[0.04] p-4">
          <p className="text-[12.5px] leading-relaxed text-silver">
            <span className="font-semibold text-soft-white">How STARC schedules work:</span> automations run on adaptive schedules based on your
            activity. The Reminder Engine and Knowledge Capture never sleep; batch tasks like the Daily Briefing defer to your preferred time. New
            integrations (calendar providers, messaging, browser) will appear in this grid automatically.
          </p>
        </div>
      </div>
    </PageContainer>
  )
}
