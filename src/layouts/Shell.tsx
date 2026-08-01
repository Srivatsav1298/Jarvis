import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { useUIStore } from '@/stores/uiStore'
import { useMetricsStore } from '@/stores/metricsStore'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { StatusStrip } from './StatusStrip'
import { MemoryDock } from './MemoryDock'
import { CommandPalette } from '@/features/shared/CommandPalette'
import { Toaster } from '@/components/ui'
import { useGlobalHotkeys } from '@/hooks/useHotkeys'
import { ALL_NAV } from './nav'
import { readStored, writeStored } from '@/hooks/useLocalStorage'

const DOCK_LAYOUT_KEY = 'starc-dock-layout'
const DOCK_LAYOUT: Record<string, number> = readStored(DOCK_LAYOUT_KEY, { main: 76, dock: 24 })

export function Shell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const setPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen)
  const dockOpen = useUIStore((s) => s.memoryDockOpen)
  const pushToast = useUIStore((s) => s.pushToast)
  const pendingG = useRef(false)

  useEffect(() => {
    useMetricsStore.getState().start()
    return () => useMetricsStore.getState().stop()
  }, [])

  useGlobalHotkeys('mod+k', () => setPaletteOpen(true))

  // "g <key>" view navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing =
        target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (typing) {
        pendingG.current = false
        return
      }
      if (e.key.toLowerCase() === 'g') {
        pendingG.current = true
        e.preventDefault()
        return
      }
      if (pendingG.current) {
        pendingG.current = false
        const item = ALL_NAV.find((n) => n.shortcut.split(' ')[1] === e.key.toLowerCase())
        if (item) navigate(item.path)
        else if (e.key === ',') navigate('/settings')
        else if (e.key.toLowerCase() === 'c') navigate('/career')
        else if (e.key.toLowerCase() === 'i') navigate('/intelligence')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  useEffect(() => {
    pushToast({
      title: 'STARC is online',
      message: 'All systems nominal · monitoring your workspace',
      tone: 'success',
    })
  }, [])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-bg text-silver">
      <AmbientBackground />

      <Sidebar />

      <Group
        orientation="horizontal"
        defaultLayout={DOCK_LAYOUT}
        onLayoutChanged={(layout, meta) => {
          if (meta.isUserInteraction) writeStored(DOCK_LAYOUT_KEY, layout)
        }}
        className="relative z-10 h-full pl-[72px]"
      >
        <Panel id="main" defaultSize="76%" minSize="55%">
          <div className="flex h-full min-h-0 flex-col">
            <TopBar />
            <main id="main-content" className="relative min-h-0 flex-1">
              {children}
            </main>
            <StatusStrip />
          </div>
        </Panel>

        {dockOpen && (
          <>
            <Separator className="group relative w-1 shrink-0 transition-colors hover:bg-accent/20">
              <span className="absolute inset-y-3 left-1/2 w-px -translate-x-1/2 bg-white/[0.06] transition-colors group-hover:bg-accent/40" />
            </Separator>
            <Panel id="dock" defaultSize="24%" minSize="17%" maxSize="34%" className="bg-graphite/30">
              <MemoryDock />
            </Panel>
          </>
        )}
      </Group>

      <CommandPalette />
      <Toaster />
    </div>
  )
}

function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      <div className="ambient-vignette absolute inset-0" />
      <div className="ambient-grid absolute inset-0" />
      <div className="absolute -left-40 -top-40 size-[560px] rounded-full bg-accent/[0.03] blur-[140px]" />
      <div className="absolute -right-40 bottom-0 size-[480px] rounded-full bg-white/[0.02] blur-[120px]" />
    </div>
  )
}
