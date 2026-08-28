import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { PageContainer, PageHeader } from '@/features/shared/PageContainer'
import { JobCard } from '@/features/career/JobCard'
import { fetchJobs, jobLogoHue } from '@/services/jobs'
import type { Job, JobStatus } from '@/types'
import { Badge, Button, ProgressBar, SearchInput, Tabs } from '@/components/ui'
import { useOrbStore } from '@/stores/orbStore'
import { useUIStore } from '@/stores/uiStore'
import { formatSalary } from '@/utils/format'

type Filter = 'all' | 'top' | JobStatus

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'top', label: 'Top Picks' },
  { id: 'new', label: 'New' },
  { id: 'saved', label: 'Saved' },
  { id: 'applied', label: 'Applied' },
  { id: 'interview', label: 'Interview' },
]

export default function CareerPage() {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Job | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const setOrbMode = useOrbStore((s) => s.setMode)
  const pushToast = useUIStore((s) => s.pushToast)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    fetchJobs(undefined, controller.signal)
      .then(setJobs)
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  const scanNow = async () => {
    setOrbMode('processing')
    pushToast({ title: 'Scanning job market', message: 'Checking 4 boards for new matches…', tone: 'info' })
    try {
      const fresh = await fetchJobs(undefined, undefined, true)
      setJobs(fresh)
      pushToast({ title: 'Scan complete', message: `${fresh.length} live roles refreshed.`, tone: 'success' })
      useOrbStore.getState().setMode('completed')
    } catch {
      pushToast({ title: 'Scan failed', message: 'Boards unreachable — showing last refresh.', tone: 'error' })
      useOrbStore.getState().setMode('monitoring')
    }
  }

  const visible = useMemo(() => {
    return jobs
      .filter((j) => {
        if (filter === 'all') return true
        if (filter === 'top') return j.aiRecommendation === 'top'
        return j.status === filter
      })
      .filter((j) =>
        `${j.company} ${j.role} ${j.location} ${j.skills.join(' ')}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      )
  }, [jobs, filter, query])

  return (
    <PageContainer className="p-5 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1400px]">
        <PageHeader
          eyebrow="Career Intelligence"
          title="Opportunities"
          subtitle={`${jobs.length} live roles · refreshed daily at 07:00`}
          actions={
            <Button variant="secondary" onClick={scanNow}>
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}>
                ⌁
              </motion.span>
              Scan now
            </Button>
          }
        />

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            items={FILTERS.map((f) => ({ id: f.id, label: f.label }))}
            active={filter}
            onChange={(id) => setFilter(id as Filter)}
          />
          <SearchInput value={query} onChange={setQuery} onClear={() => setQuery('')} placeholder="Filter jobs…" className="sm:w-64" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((job) => (
            <JobCard key={job.id} job={job} onSelect={(j) => setSelected(j)} />
          ))}
        </div>

        {loading && (
          <div className="mt-8 text-center text-sm text-muted">Scanning the boards, Sir…</div>
        )}

        {!loading && visible.length === 0 && (
          <div className="mt-8 text-center text-sm text-muted">No roles match your filter, Sir.</div>
        )}

        {selected && <JobDetailModal job={selected} onClose={() => setSelected(null)} />}
      </div>
    </PageContainer>
  )
}

function JobDetailModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const pushToast = useUIStore((s) => s.pushToast)
  const setOrbMode = useOrbStore((s) => s.setMode)

  const run = (title: string, message: string) => {
    setOrbMode('processing')
    pushToast({ title, message, tone: 'info' })
    window.setTimeout(() => useOrbStore.getState().setMode('completed'), 1600)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="glass-raised relative z-10 max-h-[82vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6"
      >
        <div className="flex items-start gap-4">
          <span
            className="grid size-14 shrink-0 place-items-center rounded-2xl border border-white/10 text-xl font-bold text-soft-white"
            style={{ backgroundImage: `linear-gradient(135deg, hsl(${jobLogoHue(job.company)} 25% 22%), hsl(${jobLogoHue(job.company)} 35% 13%))` }}
          >
            {job.company[0]}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-soft-white">{job.role}</h2>
            <p className="text-[13px] text-muted">{job.company} · {job.location}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="ok">{formatSalary(job.salary.min, job.salary.max, job.salary.currency)}</Badge>
              <Badge>{job.remote}</Badge>
              {job.visaSponsor && <Badge tone="accent">Visa sponsorship</Badge>}
            </div>
          </div>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-white/[0.06] hover:text-soft-white" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Match', value: `${job.match}%` },
            { label: 'Interview prob.', value: `${job.interviewProbability}%` },
            { label: 'Growth', value: `${job.growthPotential}%` },
            { label: 'Competition', value: `${job.competition}/100` },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-center">
              <p className="font-mono text-lg font-semibold text-soft-white">{s.value}</p>
              <p className="text-[9px] uppercase tracking-[0.14em] text-muted">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">AI Summary</p>
          <p className="text-[13px] leading-relaxed text-silver">{job.aiSummary}</p>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Required skills</p>
          <div className="flex flex-wrap gap-1.5">
            {job.skills.map((s) => (
              <span key={s} className="rounded-md border border-white/[0.07] bg-white/[0.04] px-2 py-1 font-mono text-[11px] text-silver">{s}</span>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/[0.06] bg-graphite/50 p-3">
          <div className="mb-1 flex justify-between text-[11px] text-muted">
            <span>Skill coverage</span>
            <span className="font-mono text-accent">{Math.round(job.match * 0.92)}%</span>
          </div>
          <ProgressBar value={job.match / 100} tone="accent" />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => run('Application drafted', `Resume tailored for ${job.company}.`)}>Apply</Button>
          <Button variant="secondary" onClick={() => run('Cover letter ready', 'Targeted letter generated.')}>Generate Cover Letter</Button>
          <Button variant="secondary" onClick={() => run('Resume tailored', `Matched ${job.skills.length} key skills.`)}>Tailor Resume</Button>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </motion.div>
    </div>
  )
}
