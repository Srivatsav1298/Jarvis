import { useState } from 'react'
import { motion } from 'framer-motion'
import { jobLogoHue } from '@/services/jobs'
import type { Job } from '@/types'
import { Badge, Button, ProgressRing } from '@/components/ui'
import { formatSalary, relativeTime } from '@/utils/format'
import { cn } from '@/utils/cn'
import { audioService } from '@/services/audio'
import { useUIStore } from '@/stores/uiStore'
import { useOrbStore } from '@/stores/orbStore'
import {
  HiOutlineArrowTrendingUp,
  HiOutlineBookmark,
  HiOutlineCheckCircle,
  HiOutlineDocumentArrowDown,
  HiOutlineDocumentText,
  HiOutlineScale,
  HiOutlineSparkles,
  HiOutlineUserGroup,
} from 'react-icons/hi2'

const REC_TONE = {
  top: 'accent',
  apply: 'ok',
  consider: 'warn',
  pass: 'neutral',
} as const

const REC_LABEL = {
  top: 'Top Pick',
  apply: 'Apply',
  consider: 'Consider',
  pass: 'Pass',
} as const

const REMOTE_LABEL = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' } as const

const SOURCE_LABEL: Record<string, string> = {
  'finn.no': 'Finn',
  jobbnorge: 'Jobbnorge',
  linkedin: 'LinkedIn',
}

function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? (source ? source.charAt(0).toUpperCase() + source.slice(1) : 'Job board')
}

function postedTime(job: Job): string {
  if (job.fetchedAt) {
    const ts = new Date(job.fetchedAt).getTime()
    if (Number.isFinite(ts)) return relativeTime(ts)
  }
  return `${job.postedDaysAgo}d ago`
}

export function JobCard({
  job,
  onSelect,
}: {
  job: Job
  onSelect?: (job: Job) => void
}) {
  const pushToast = useUIStore((s) => s.pushToast)
  const setOrbMode = useOrbStore((s) => s.setMode)
  const [expanded, setExpanded] = useState(false)
  const [saved, setSaved] = useState(job.status === 'saved')

  const act = (title: string, message: string) => {
    setOrbMode('processing')
    pushToast({ title, message, tone: 'info' })
    window.setTimeout(() => useOrbStore.getState().setMode('completed'), 1800)
  }

  const apply = () => {
    if (job.sourceUrl) {
      audioService.play('click')
      setOrbMode('processing')
      window.open(job.sourceUrl, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => useOrbStore.getState().setMode('completed'), 1200)
      pushToast({
        title: 'Opening job post',
        message: `Redirecting you to apply for ${job.role} at ${job.company}.`,
        tone: 'info',
      })
      return
    }
    act('Application drafted', `Resume tailored for ${job.company}.`)
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="glass flex flex-col rounded-card p-4 transition-colors hover:border-white/10"
    >
      <div className="flex items-start gap-3">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-xl border border-white/10 text-[15px] font-bold text-soft-white"
          style={{
            backgroundImage: `linear-gradient(135deg, hsl(${jobLogoHue(job.company)} 25% 22%), hsl(${jobLogoHue(job.company)} 35% 13%))`,
          }}
        >
          {job.company[0]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-soft-white">{job.role}</p>
              <p className="truncate text-[12px] text-muted">{job.company}</p>
            </div>
            <Badge tone={REC_TONE[job.aiRecommendation]}>
              {REC_LABEL[job.aiRecommendation]}
            </Badge>
          </div>
        </div>
        <ProgressRing value={job.match / 100} size={46} stroke={4}>
          <span className="font-mono text-[11px] text-soft-white">{job.match}%</span>
        </ProgressRing>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge tone={job.source === 'linkedin' ? 'accent' : job.source === 'finn.no' ? 'ok' : 'warn'}>
          {sourceLabel(job.source)}
        </Badge>
        {job.sourceUrl && (
          <a
            href={job.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-muted underline-offset-2 hover:text-accent hover:underline"
          >
            view post
          </a>
        )}
        <Badge>{REMOTE_LABEL[job.remote]}</Badge>
        <Badge>{job.location}</Badge>
        <Badge tone="ok">{formatSalary(job.salary.min, job.salary.max, job.salary.currency)}</Badge>
        {job.visaSponsor && <Badge tone="accent">Visa ✓</Badge>}
        <span className="ml-auto text-[10px] text-muted">{postedTime(job)}</span>
      </div>

      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <HiOutlineUserGroup className="size-3.5" /> Interview {job.interviewProbability}%
        </span>
        <span className="flex items-center gap-1">
          <HiOutlineArrowTrendingUp className="size-3.5" /> Growth {job.growthPotential}%
        </span>
        <span className="flex items-center gap-1">
          <HiOutlineScale className="size-3.5" /> Competition {job.competition}/100
        </span>
        <span className="ml-auto font-mono">Exp {formatSalary(job.expectedSalary, job.expectedSalary, job.salary.currency)}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {job.skills.map((s) => (
          <span key={s} className="rounded-md border border-white/[0.07] bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-silver">
            {s}
          </span>
        ))}
      </div>

      <button
        onClick={() => setExpanded((e) => !e)}
        className="mt-3 flex items-start gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] p-2.5 text-left transition-colors hover:bg-white/[0.04]"
      >
        <HiOutlineSparkles className="mt-0.5 size-3.5 shrink-0 text-accent" />
        <span className="text-[12px] leading-relaxed text-silver">
          {expanded ? job.aiSummary : `${job.aiSummary.slice(0, 110)}…`}
        </span>
      </button>

      <div className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-3">
        <Button size="sm" variant="primary" onClick={apply}>
          Apply
        </Button>
        <Button
          size="sm"
          variant="secondary"
          aria-pressed={saved}
          onClick={() => {
            setSaved((v) => !v)
            audioService.play('click')
          }}
        >
          <HiOutlineBookmark className={cn('size-3.5', saved && 'text-accent')} />
          {saved ? 'Saved' : 'Save'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => act('Resume tailored', `Matched ${job.skills.length} skills.`)}>
          <HiOutlineDocumentText className="size-3.5" /> Resume
        </Button>
        <Button size="sm" variant="ghost" onClick={() => act('Cover letter ready', 'Generated a targeted letter.')}>
          <HiOutlineDocumentArrowDown className="size-3.5" /> Letter
        </Button>
        <button
          onClick={() => onSelect?.(job)}
          className="ml-auto grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-soft-white"
          aria-label={`Compare ${job.company}`}
        >
          <HiOutlineCheckCircle className="size-4" />
        </button>
      </div>
    </motion.article>
  )
}
