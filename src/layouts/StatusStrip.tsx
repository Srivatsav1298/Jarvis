import { useMetricsStore } from '@/stores/metricsStore'
import { useNow } from '@/hooks/useAudioLevel'
import { clockNow, formatUptime } from '@/utils/format'
import { StatusDot } from '@/components/ui'
import { cn } from '@/utils/cn'

function Metric({ label, value, dot }: { label: string; value: string; dot?: 'ok' | 'warn' | 'accent' }) {
  return (
    <div className="flex items-center gap-1.5">
      {dot && <StatusDot tone={dot} />}
      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</span>
      <span className="font-mono text-[11px] font-medium text-silver">{value}</span>
    </div>
  )
}

export function StatusStrip() {
  const m = useMetricsStore()
  const now = useNow(1000)

  return (
    <footer className="relative z-30 flex h-9 shrink-0 items-center justify-between gap-4 border-t border-white/[0.05] bg-graphite/50 px-5 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-4">
        <div className="hidden items-center gap-2 sm:flex">
          <span className="grid size-4 place-items-center rounded-full border border-accent/40">
            <span className="size-1.5 rounded-full bg-accent" />
          </span>
          <span className="font-mono text-[10px] font-semibold tracking-[0.16em] text-accent">
            STARC
          </span>
          <span className="font-mono text-[10px] text-muted">{m.engine.model}</span>
        </div>
        <div className="hidden items-center gap-4 md:flex">
          <Metric label="CPU" value={`${Math.round(m.cpu)}%`} dot="accent" />
          <Metric label="RAM" value={`${Math.round(m.ram)}%`} />
          <Metric label="TEMP" value={`${Math.round(m.temperature)}°`} dot={m.temperature > 65 ? 'warn' : undefined} />
          <Metric label="LAT" value={`${Math.round(m.network.latencyMs)}ms`} />
          <Metric label="UP" value={formatUptime(m.engine.uptime)} />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 xl:flex">
          <Metric
            label="NET"
            value={m.network.connected ? `${m.network.downMbps.toFixed(0)}↓` : 'OFF'}
            dot={m.network.connected ? 'ok' : 'warn'}
          />
        </div>
        <div className="flex items-center gap-2">
          <StatusDot tone={m.mic.active ? 'accent' : 'neutral'} pulse={m.mic.active} />
          <span className={cn('text-[10px]', m.mic.active ? 'text-accent' : 'text-muted')}>MIC</span>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <StatusDot tone={m.camera.active ? 'accent' : 'neutral'} pulse={m.camera.active} />
          <span className={cn('text-[10px]', m.camera.active ? 'text-accent' : 'text-muted')}>CAM</span>
        </div>
        <span className="font-mono text-[11px] font-medium text-silver">{clockNow(now)}</span>
      </div>
    </footer>
  )
}
