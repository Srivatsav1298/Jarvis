import { useNavigate } from 'react-router-dom'
import { Card, PanelHeader, Icon } from '@/components/ui'
import { useMemoryStore } from '@/stores/memoryStore'
import { HiOutlineArrowRight } from 'react-icons/hi2'

export function MemorySnapshot() {
  const navigate = useNavigate()
  const facts = useMemoryStore((s) => s.facts)
  const goals = useMemoryStore((s) => s.goals)
  const timeline = useMemoryStore((s) => s.timeline)

  return (
    <Card className="p-4">
      <PanelHeader
        title="Memory Snapshot"
        subtitle="What STARC remembers"
        icon={<Icon name="cpu" className="size-4" />}
        action={
          <button
            onClick={() => navigate('/memory')}
            aria-label="Open memory"
            className="grid size-7 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-soft-white"
          >
            <HiOutlineArrowRight className="size-3.5" />
          </button>
        }
      />

      <div className="mt-3 flex gap-2">
        {[
          { label: 'Facts', value: facts.length },
          { label: 'Goals', value: goals.length },
          { label: 'Timeline', value: timeline.length },
        ].map((s) => (
          <div
            key={s.label}
            className="flex-1 rounded-xl border border-white/[0.05] bg-white/[0.03] px-3 py-2 text-center"
          >
            <p className="font-mono text-lg font-semibold text-soft-white">{s.value}</p>
            <p className="text-[9px] uppercase tracking-[0.14em] text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        {timeline.slice(0, 2).map((t) => (
          <div key={t.id} className="flex items-start gap-2.5">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent/70" />
            <div>
              <p className="text-[12px] leading-snug text-silver">{t.text}</p>
              <p className="font-mono text-[10px] text-muted">{t.at}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
