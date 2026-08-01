import { useState } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useOrbStore } from '@/stores/orbStore'
import { useMetricsStore } from '@/stores/metricsStore'
import { useNow } from '@/hooks/useAudioLevel'
import { useInterval } from '@/hooks/useInterval'
import { greeting, fullDate, clockNow } from '@/utils/format'
import { presenceFor } from '@/services/presence'
import { Avatar, Kbd, StatusChip, StatusDot } from '@/components/ui'
import { NotificationCenter } from '@/features/shared/NotificationCenter'
import { HiOutlineCommandLine } from 'react-icons/hi2'

function AiStatusPill() {
  const presenceMode = useOrbStore((s) => s.presence)
  const [salt, setSalt] = useState(0)
  useInterval(() => setSalt((v) => v + 1), 8000)
  const text = presenceFor(presenceMode, salt)

  return (
    <StatusChip tone="accent" pulse>
      <span className="max-w-[200px] truncate">{text}</span>
    </StatusChip>
  )
}

export function TopBar() {
  const now = useNow(1000)
  const profile = useUIStore((s) => s.profile)
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen)
  const network = useMetricsStore((s) => s.network)
  const battery = useMetricsStore((s) => s.battery)
  const batteryCharging = useMetricsStore((s) => s.batteryCharging)

  return (
    <header className="relative z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-white/[0.05] bg-graphite/40 px-5 backdrop-blur-xl">
      <div className="min-w-0">
        <h1 className="truncate text-[15px] font-semibold tracking-tight text-soft-white">
          {greeting(now)}, {profile.name}
        </h1>
        <p className="hidden truncate text-[11px] text-muted sm:block">{fullDate(now)}</p>
      </div>

      <div className="hidden items-center gap-2 md:flex">
        <AiStatusPill />
      </div>

      <div className="flex items-center gap-1.5">
        <div className="mr-1 hidden items-center gap-2 lg:flex">
          <StatusDot tone={network.connected ? 'ok' : 'danger'} pulse={network.connected} />
          <span className="font-mono text-[11px] text-muted">
            {batteryCharging ? '⚡' : ''}
            {Math.round(battery)}%
          </span>
        </div>

        <span className="mr-1 hidden font-mono text-[12px] font-medium text-silver sm:block">
          {clockNow(now)}
        </span>

        <NotificationCenter />

        <button
          onClick={() => setCommandPaletteOpen(true)}
          aria-label="Open command palette"
          className="flex h-9 items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 text-silver transition-colors hover:bg-white/[0.08] hover:text-soft-white"
        >
          <HiOutlineCommandLine className="size-4" />
          <Kbd>⌘ K</Kbd>
        </button>

        <button aria-label="Profile" className="ml-1 grid size-9 place-items-center">
          <Avatar name={profile.name} hue={196} size={32} />
        </button>
      </div>
    </header>
  )
}
