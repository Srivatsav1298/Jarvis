import { useNavigate } from 'react-router-dom'
import { Card, PanelHeader, Icon, StatusDot, type StatusTone } from '@/components/ui'
import { useMetricsStore } from '@/stores/metricsStore'
import { HiOutlineArrowRight } from 'react-icons/hi2'
import { cn } from '@/utils/cn'

export function SystemHealth() {
  const navigate = useNavigate()
  const m = useMetricsStore()

  const items: { label: string; value: string; tone: StatusTone }[] = [
    { label: 'CPU', value: `${Math.round(m.cpu)}%`, tone: m.cpu > 80 ? 'warn' : 'ok' },
    { label: 'RAM', value: `${Math.round(m.ram)}%`, tone: m.ram > 85 ? 'warn' : 'ok' },
    { label: 'Temp', value: `${Math.round(m.temperature)}°C`, tone: m.temperature > 72 ? 'warn' : 'ok' },
    { label: 'Engine', value: m.engine.model, tone: 'ok' },
    { label: 'Battery', value: `${Math.round(m.battery)}%`, tone: m.battery < 20 ? 'warn' : 'ok' },
    { label: 'Network', value: `${m.network.downMbps.toFixed(0)} Mbps`, tone: m.network.connected ? 'ok' : 'danger' },
  ]

  return (
    <Card className="p-4">
      <PanelHeader
        title="System Health"
        subtitle="All nominal"
        icon={<Icon name="gauge" className="size-4" />}
        action={
          <button
            onClick={() => navigate('/system')}
            aria-label="Open system"
            className="grid size-7 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-soft-white"
          >
            <HiOutlineArrowRight className="size-3.5" />
          </button>
        }
      />

      <div className="mt-4 grid grid-cols-2 gap-2">
        {items.map((s) => (
          <div
            key={s.label}
            className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.03] px-3 py-2"
          >
            <span className="flex items-center gap-2 text-[11px] text-muted">
              <StatusDot tone={s.tone} />
              {s.label}
            </span>
            <span className={cn('font-mono text-[11px] font-medium text-silver')}>{s.value}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
