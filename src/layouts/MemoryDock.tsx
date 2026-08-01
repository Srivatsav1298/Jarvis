import { motion } from 'framer-motion'
import { useMemoryStore } from '@/stores/memoryStore'
import { useUIStore } from '@/stores/uiStore'
import { useNavigate } from 'react-router-dom'
import { Icon, ProgressBar, ScrollArea, SearchInput, Separator } from '@/components/ui'
import { HiOutlineXMark } from 'react-icons/hi2'
import { audioService } from '@/services/audio'

export function MemoryDock() {
  const setOpen = useUIStore((s) => s.setMemoryDockOpen)
  const pinned = useMemoryStore((s) => s.pinned)
  const projects = useMemoryStore((s) => s.projects)
  const goals = useMemoryStore((s) => s.goals)
  const facts = useMemoryStore((s) => s.facts)
  const search = useMemoryStore((s) => s.search)
  const setSearch = useMemoryStore((s) => s.setSearch)
  const navigate = useNavigate()

  const openMemory = () => {
    audioService.play('click')
    setOpen(false)
    navigate('/memory')
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-accent/10 text-accent">
            <Icon name="cpu" className="size-4" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-soft-white">AI Memory</p>
            <p className="text-[10px] text-muted">Persistence graph</p>
          </div>
        </div>
        <button
          aria-label="Close memory dock"
          onClick={() => setOpen(false)}
          className="grid size-7 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-soft-white"
        >
          <HiOutlineXMark className="size-4" />
        </button>
      </div>

      <div className="px-3 pt-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          onClear={() => setSearch('')}
          placeholder="Search memory…"
          className="h-9 [&_input]:h-9"
        />
      </div>

      <ScrollArea className="px-3 py-3">
        <Section title="Pinned Context" icon="bookmark">
          {pinned.map((p) => (
            <button
              key={p.id}
              onClick={openMemory}
              className="group w-full rounded-xl border border-white/[0.05] bg-white/[0.03] p-2.5 text-left transition-colors hover:border-accent/20 hover:bg-white/[0.05]"
            >
              <p className="flex items-center gap-1.5 text-[12px] font-medium text-soft-white">
                <Icon name={p.kind === 'career' ? 'briefcase' : p.kind === 'document' ? 'document' : 'key'} className="size-3.5 text-accent" />
                {p.label}
              </p>
              <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted">{p.snippet}</p>
            </button>
          ))}
        </Section>

        <Section title="Active Projects" icon="target">
          {projects
            .filter((p) => p.status === 'active')
            .map((p) => (
              <div key={p.id} className="py-1.5">
                <div className="mb-1 flex items-center justify-between">
                  <span className="truncate text-[12px] font-medium text-silver">{p.name}</span>
                  <span className="font-mono text-[10px] text-muted">{Math.round(p.progress * 100)}%</span>
                </div>
                <ProgressBar value={p.progress} tone="accent" />
              </div>
            ))}
        </Section>

        <Section title="Recent Facts" icon="light">
          {facts.slice(0, 3).map((f) => (
            <p key={f.id} className="py-1 text-[11px] leading-relaxed text-silver">
              <span className="text-muted">·</span> {f.text}
            </p>
          ))}
        </Section>

        <Section title="Goals" icon="target">
          {goals.slice(0, 2).map((g) => (
            <div key={g.id} className="mb-2 rounded-xl border border-white/[0.05] bg-white/[0.03] p-2.5">
              <p className="text-[12px] font-medium text-soft-white">{g.title}</p>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[10px] text-muted">{g.target}</span>
                <motion.span className="font-mono text-[10px] text-accent">
                  {Math.round(g.progress * 100)}%
                </motion.span>
              </div>
            </div>
          ))}
        </Section>

        <button
          onClick={openMemory}
          className="mt-1 w-full rounded-[10px] border border-white/10 bg-white/[0.04] py-2 text-[12px] font-medium text-silver transition-colors hover:bg-white/[0.08] hover:text-soft-white"
        >
          Open full Memory
        </button>
      </ScrollArea>

      <Separator />
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        <Icon name={icon} className="size-3" />
        {title}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}
