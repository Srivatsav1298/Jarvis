import { useState } from 'react'
import { motion } from 'framer-motion'
import { PageContainer, PageHeader } from '@/features/shared/PageContainer'
import { useMemoryStore } from '@/stores/memoryStore'
import { Badge, Card, Icon, ProgressBar, ProgressRing, SearchInput } from '@/components/ui'
import { Button } from '@/components/ui'
import { cn } from '@/utils/cn'

const STATUS_TONE = { active: 'ok', paused: 'warn', completed: 'accent' } as const

export default function MemoryPage() {
  const search = useMemoryStore((s) => s.search)
  const setSearch = useMemoryStore((s) => s.setSearch)
  const projects = useMemoryStore((s) => s.projects)
  const goals = useMemoryStore((s) => s.goals)
  const preferences = useMemoryStore((s) => s.preferences)
  const pinned = useMemoryStore((s) => s.pinned)
  const facts = useMemoryStore((s) => s.facts)
  const timeline = useMemoryStore((s) => s.timeline)
  const addFact = useMemoryStore((s) => s.addFact)
  const removeFact = useMemoryStore((s) => s.removeFact)

  const [factText, setFactText] = useState('')

  const q = search.trim().toLowerCase()
  const matches = (text: string) => !q || text.toLowerCase().includes(q)

  const filteredProjects = projects.filter((p) => matches(p.name) || matches(p.description))
  const filteredGoals = goals.filter((g) => matches(g.title))
  const filteredPinned = pinned.filter((p) => matches(p.label) || matches(p.snippet))
  const filteredFacts = facts.filter((f) => matches(f.text))
  const filteredPrefs = preferences.filter((p) => matches(p.key) || matches(p.value))

  const submitFact = () => {
    if (!factText.trim()) return
    addFact(factText.trim(), 'personal')
    setFactText('')
  }

  return (
    <PageContainer className="p-5 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1400px]">
        <PageHeader
          eyebrow="AI Memory"
          title="Persistence Graph"
          subtitle="Everything STARC remembers about you, your work, and your preferences"
          actions={<SearchInput value={search} onChange={setSearch} onClear={() => setSearch('')} placeholder="Search memory…" className="w-60" />}
        />

        <div className="grid gap-5 lg:grid-cols-3">
          {/* Projects + Goals */}
          <div className="space-y-5 lg:col-span-2">
            <Card className="p-5">
              <SectionTitle icon="target" title="Projects" count={filteredProjects.length} />
              <div className="mt-3 space-y-2">
                {filteredProjects.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-xl border border-white/[0.05] bg-white/[0.03] p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-soft-white">{p.name}</p>
                        <p className="truncate text-[11px] text-muted">{p.description}</p>
                      </div>
                      <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <ProgressBar value={p.progress} tone="accent" className="flex-1" />
                      <span className="font-mono text-[10px] text-muted">{Math.round(p.progress * 100)}%</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <SectionTitle icon="star" title="Goals" count={filteredGoals.length} className="mt-6" />
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {filteredGoals.map((g) => (
                  <div key={g.id} className="flex flex-col items-center rounded-xl border border-white/[0.05] bg-white/[0.03] p-4 text-center">
                    <ProgressRing value={g.progress} size={58} tone="accent">
                      <span className="font-mono text-[11px] text-soft-white">{Math.round(g.progress * 100)}</span>
                    </ProgressRing>
                    <p className="mt-2 text-[12px] font-medium text-soft-white">{g.title}</p>
                    <p className="text-[10px] text-muted">{g.target}</p>
                    <Badge tone="neutral" className="mt-1.5">due {g.deadline}</Badge>
                  </div>
                ))}
              </div>

              <SectionTitle icon="clock" title="Timeline" count={timeline.length} className="mt-6" />
              <div className="mt-3 space-y-0">
                {timeline.slice(0, 6).map((t, i) => (
                  <div key={t.id} className="relative flex gap-3 pb-3">
                    <span className="relative flex flex-col items-center">
                      <span className="mt-1.5 size-1.5 rounded-full bg-accent/70" />
                      {i < 5 && <span className="my-1 w-px flex-1 bg-white/[0.07]" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] leading-snug text-silver">{t.text}</p>
                      <p className="font-mono text-[10px] text-muted">{t.at}</p>
                    </div>
                    <Badge tone="neutral">{t.kind}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            <Card className="p-5">
              <SectionTitle icon="bookmark" title="Pinned Context" count={filteredPinned.length} />
              <div className="mt-3 space-y-2">
                {filteredPinned.map((p) => (
                  <div key={p.id} className="rounded-xl border border-accent/15 bg-accent/[0.04] p-3">
                    <p className="flex items-center gap-1.5 text-[12px] font-medium text-soft-white">
                      <Icon name={p.kind === 'career' ? 'briefcase' : p.kind === 'document' ? 'document' : 'key'} className="size-3.5 text-accent" />
                      {p.label}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted">{p.snippet}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <SectionTitle icon="key" title="Preferences" count={filteredPrefs.length} />
              <div className="mt-3 space-y-2">
                {filteredPrefs.map((p) => (
                  <div key={p.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.03] px-3 py-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{p.key}</span>
                    <span className="flex-1 text-right text-[12px] text-silver">{p.value}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <SectionTitle icon="light" title="Important Facts" count={filteredFacts.length} />
              <div className="mt-3 space-y-1">
                {filteredFacts.map((f) => (
                  <div key={f.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.03]">
                    <span className="size-1.5 shrink-0 rounded-full bg-silver/60" />
                    <span className="flex-1 text-[12px] text-silver">{f.text}</span>
                    <button
                      onClick={() => removeFact(f.id)}
                      aria-label={`Forget: ${f.text}`}
                      className="hidden rounded-md px-1.5 py-0.5 text-muted transition-colors hover:bg-white/[0.06] hover:text-danger group-hover:block"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {filteredFacts.length === 0 && (
                  <p className="text-[12px] text-muted">No matching facts stored.</p>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={factText}
                  onChange={(e) => setFactText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitFact()}
                  placeholder="Teach STARC a fact…"
                  aria-label="Add a fact"
                  className="h-9 flex-1 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 text-[12px] text-soft-white placeholder:text-muted/60 focus:outline-none"
                />
                <Button size="sm" variant="secondary" onClick={submitFact}>Store</Button>
              </div>
            </Card>
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] text-muted">
          Memory persists locally · <span className="font-mono">starc.memory.v1</span>
        </p>
      </div>
    </PageContainer>
  )
}

function SectionTitle({ icon, title, count, className }: { icon: string; title: string; count: number; className?: string }) {
  return (
    <p className={cn('flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted', className)}>
      <Icon name={icon} className="size-3.5 text-accent" />
      {title}
      <span className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 text-[10px] text-silver">{count}</span>
    </p>
  )
}
