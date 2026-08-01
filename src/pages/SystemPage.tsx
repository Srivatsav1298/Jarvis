import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PageContainer, PageHeader } from '@/features/shared/PageContainer'
import { useMetricsStore } from '@/stores/metricsStore'
import { useOrbStore } from '@/stores/orbStore'
import { useUIStore } from '@/stores/uiStore'
import { Badge, Icon, ProgressBar, ProgressRing, Switch, StatusDot } from '@/components/ui'
import { RingGauge, Sparkline } from '@/components/charts'
import { formatUptime, formatBytes } from '@/utils/format'
import { STORAGE_TOTAL_GB } from '@/stores/metricsStore'
import { cn } from '@/utils/cn'
import { useIsMobile } from '@/hooks/useMediaQuery'

function HealthTile({
  label,
  icon,
  value,
  sub,
  status,
  history,
  children,
  defaultOpen = false,
}: {
  label: string
  icon: string
  value: string
  sub: string
  status: 'ok' | 'warn' | 'danger' | 'accent' | 'neutral'
  history?: number[]
  children?: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="glass overflow-hidden rounded-card">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-silver">
          <Icon name={icon} className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-soft-white">{label}</span>
            <StatusDot tone={status} pulse={status === 'ok'} />
          </div>
          <p className="truncate font-mono text-[11px] text-muted">{sub}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[15px] font-semibold text-soft-white">{value}</span>
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-muted">
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </motion.span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="border-t border-white/[0.06] p-4">
              {history && (
                <div className="mb-3">
                  <Sparkline data={history} height={40} stroke="rgba(167,227,255,0.8)" fill="rgba(167,227,255,0.25)" min={0} max={100} />
                </div>
              )}
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function SystemPage() {
  const m = useMetricsStore()
  const setMic = useMetricsStore((s) => s.setMic)
  const setCamera = useMetricsStore((s) => s.setCamera)
  const setOrbMode = useOrbStore((s) => s.setMode)
  const pushToast = useUIStore((s) => s.pushToast)
  const isMobile = useIsMobile()

  const storagePct = m.storageUsed / STORAGE_TOTAL_GB

  const restartEngine = () => {
    setOrbMode('processing')
    pushToast({ title: 'Restarting AI engine', message: 'Reinitializing STARC-N2…', tone: 'info' })
    window.setTimeout(() => {
      useOrbStore.getState().setMode('completed')
      pushToast({ title: 'Engine online', message: 'All systems nominal.', tone: 'success' })
    }, 1600)
  }

  return (
    <PageContainer className="p-5 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1200px]">
        <PageHeader
          eyebrow="System"
          title="Health Monitor"
          subtitle="Simple summaries · expand for detail"
          actions={
            <button onClick={restartEngine} className="h-9 rounded-[10px] border border-white/10 bg-white/[0.05] px-4 text-[13px] font-medium text-soft-white transition-colors hover:bg-white/[0.08]">
              Restart Engine
            </button>
          }
        />

        {/* Engine hero */}
        <div className="glass-raised mb-5 grid gap-5 rounded-card p-5 md:grid-cols-[auto_1fr]">
          <div className="flex items-center gap-5">
            <ProgressRing value={1 - m.engine.load / 100} size={96} stroke={7} tone="accent">
              <div className="text-center">
                <p className="font-mono text-lg font-semibold text-soft-white">{Math.round(m.engine.load)}%</p>
                <p className="text-[8px] uppercase tracking-wider text-muted">load</p>
              </div>
            </ProgressRing>
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-soft-white">
                <span className="size-1.5 rounded-full bg-ok" /> STARC Engine
              </p>
              <p className="font-mono text-[11px] text-muted">{m.engine.model} · v2.4.1</p>
              <div className="mt-2 flex gap-2">
                <Badge tone="ok">Nominal</Badge>
                <Badge>{formatUptime(m.engine.uptime)} up</Badge>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {[
              { label: 'Model temp', value: `${Math.round(m.engine.temp)}°C`, icon: 'gauge' },
              { label: 'Tokens today', value: m.engine.tokensToday.toLocaleString(), icon: 'chat' },
              { label: 'Latency', value: `${Math.round(m.network.latencyMs)}ms`, icon: 'signal' },
              { label: 'Uptime', value: formatUptime(m.engine.uptime), icon: 'clock' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/[0.05] bg-white/[0.03] p-3">
                <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.14em] text-muted">
                  <Icon name={s.icon} className="size-3" /> {s.label}
                </p>
                <p className="mt-1 font-mono text-[13px] font-medium text-silver">{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Health tiles */}
        <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'sm:grid-cols-2 xl:grid-cols-3')}>
          <HealthTile
            label="Processor"
            icon="cpu"
            value={`${Math.round(m.cpu)}%`}
            sub={`${Math.round(m.cpu)}% of 12 cores`}
            status={m.cpu > 80 ? 'warn' : 'ok'}
            history={m.history.cpu}
          >
            <ProgressBar value={m.cpu / 100} tone={m.cpu > 80 ? 'warn' : 'accent'} />
            <p className="mt-2 text-[11px] text-muted">Peak this session: {Math.max(...m.history.cpu).toFixed(0)}%</p>
          </HealthTile>

          <HealthTile
            label="Memory"
            icon="chart"
            value={`${Math.round(m.ram)}%`}
            sub={`${Math.round((m.ram / 100) * 32)} GB of 32 GB`}
            status={m.ram > 85 ? 'warn' : 'ok'}
            history={m.history.ram}
          >
            <ProgressBar value={m.ram / 100} tone={m.ram > 85 ? 'warn' : 'accent'} />
          </HealthTile>

          <HealthTile
            label="Graphics"
            icon="rocket"
            value={`${Math.round(m.gpu)}%`}
            sub="CUDA engine · 24 GB VRAM"
            status="neutral"
            history={m.history.gpu}
          >
            <ProgressBar value={m.gpu / 100} tone="silver" />
          </HealthTile>

          <HealthTile
            label="Storage"
            icon="folder"
            value={`${STORAGE_TOTAL_GB - Math.round(m.storageUsed)} GB free`}
            sub={`${formatBytes(m.storageUsed * 1e9)} of ${STORAGE_TOTAL_GB} GB`}
            status={storagePct > 0.9 ? 'warn' : 'ok'}
            defaultOpen={isMobile}
          >
            <div className="flex items-center gap-4">
              <RingGauge value={storagePct} size={64} label={`${Math.round(storagePct * 100)}%`} sublabel="used" color={storagePct > 0.9 ? '#D8C48A' : '#A7E3FF'} />
              <ProgressBar value={storagePct} tone={storagePct > 0.9 ? 'warn' : 'accent'} className="flex-1" />
            </div>
          </HealthTile>

          <HealthTile
            label="Temperature"
            icon="gauge"
            value={`${Math.round(m.temperature)}°C`}
            sub="Thermal envelope nominal"
            status={m.temperature > 72 ? 'warn' : 'ok'}
            history={m.history.temp}
            defaultOpen={isMobile}
          >
            <RingGauge value={m.temperature / 100} size={64} label={`${Math.round(m.temperature)}°`} color={m.temperature > 72 ? '#D8C48A' : '#A7E3FF'} />
          </HealthTile>

          <HealthTile
            label="Network"
            icon="wifi"
            value={`${m.network.downMbps.toFixed(0)} Mbps`}
            sub={`${m.network.type} · ${m.network.ssid}`}
            status={m.network.connected ? 'ok' : 'danger'}
            history={m.history.netDown}
            defaultOpen={isMobile}
          >
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-white/[0.05] bg-white/[0.03] p-2 text-center">
                <p className="font-mono text-[13px] text-silver">{m.network.downMbps.toFixed(0)}</p>
                <p className="text-[9px] uppercase tracking-wider text-muted">↓ down</p>
              </div>
              <div className="rounded-lg border border-white/[0.05] bg-white/[0.03] p-2 text-center">
                <p className="font-mono text-[13px] text-silver">{m.network.upMbps.toFixed(0)}</p>
                <p className="text-[9px] uppercase tracking-wider text-muted">↑ up</p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted">Latency {Math.round(m.network.latencyMs)}ms · last test 4m ago</p>
          </HealthTile>

          <HealthTile
            label="Battery"
            icon="battery"
            value={`${Math.round(m.battery)}%`}
            sub={m.batteryCharging ? 'Charging · expected full in 52m' : 'On battery'}
            status={m.battery < 20 ? 'warn' : 'ok'}
            defaultOpen={isMobile}
          >
            <RingGauge value={m.battery / 100} size={64} label={`${Math.round(m.battery)}%`} sublabel={m.batteryCharging ? 'charging' : 'battery'} color="#8FCA9A" />
          </HealthTile>
        </div>

        {/* Sensors */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <SensorCard
            icon="microphone"
            label="Microphone"
            active={m.mic.active}
            level={m.mic.level}
            onToggle={(v) => {
              setMic(v, v ? 0.2 : 0)
              if (v) pushToast({ title: 'Microphone active', message: 'STARC can hear you.', tone: 'info' })
            }}
          />
          <SensorCard
            icon="camera"
            label="Camera"
            active={m.camera.active}
            level={m.camera.level}
            onToggle={(v) => {
              setCamera(v, v ? 0.3 : 0)
              if (v) pushToast({ title: 'Camera active', message: 'STARC is watching the room.', tone: 'info' })
            }}
          />
          <div className="glass flex items-center justify-between rounded-card p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-silver">
                <Icon name="globe" className="size-4" />
              </span>
              <div>
                <p className="text-[12px] font-semibold text-soft-white">Location</p>
                <p className="font-mono text-[11px] text-muted">
                  {m.location.city} · {m.location.lat.toFixed(2)}, {m.location.lng.toFixed(2)}
                </p>
              </div>
            </div>
            <Badge tone="ok">On</Badge>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

function SensorCard({
  icon,
  label,
  active,
  level,
  onToggle,
}: {
  icon: string
  label: string
  active: boolean
  level: number
  onToggle: (v: boolean) => void
}) {
  return (
    <div className="glass flex items-center justify-between rounded-card p-4">
      <div className="flex items-center gap-3">
        <span className={cn('grid size-9 place-items-center rounded-xl border transition-colors', active ? 'border-accent/20 bg-accent/10 text-accent' : 'border-white/[0.08] bg-white/[0.04] text-silver')}>
          <Icon name={icon} className="size-4" />
        </span>
        <div>
          <p className="text-[12px] font-semibold text-soft-white">{label}</p>
          <p className="font-mono text-[11px] text-muted">
            {active ? `Level ${(level * 100).toFixed(0)}%` : 'Inactive'}
          </p>
        </div>
      </div>
      <Switch checked={active} onChange={onToggle} label={label} />
    </div>
  )
}
