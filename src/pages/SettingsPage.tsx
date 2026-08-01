import { useState } from 'react'
import { PageContainer, PageHeader } from '@/features/shared/PageContainer'
import { useUIStore } from '@/stores/uiStore'
import { useMemoryStore } from '@/stores/memoryStore'
import { useOrbStore } from '@/stores/orbStore'
import { Badge, Button, Card, Icon, Switch } from '@/components/ui'
import { cn } from '@/utils/cn'

function SettingRow({
  icon,
  title,
  description,
  control,
}: {
  icon: string
  title: string
  description: string
  control: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-silver">
          <Icon name={icon} className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-soft-white">{title}</p>
          <p className="text-[11.5px] leading-snug text-muted">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">{title}</h2>
      <div className="divide-y divide-white/[0.05]">{children}</div>
    </Card>
  )
}

export default function SettingsPage() {
  const soundEnabled = useUIStore((s) => s.soundEnabled)
  const setSoundEnabled = useUIStore((s) => s.setSoundEnabled)
  const reducedMotion = useUIStore((s) => s.reducedMotion)
  const setReducedMotion = useUIStore((s) => s.setReducedMotion)
  const systemReducedMotion = useUIStore((s) => s.systemReducedMotion)
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen)
  const pushToast = useUIStore((s) => s.pushToast)
  const profile = useUIStore((s) => s.profile)
  const resetMemory = useMemoryStore((s) => s.reset)
  const setOrbMode = useOrbStore((s) => s.setMode)

  const [name, setName] = useState(profile.name)
  const [role, setRole] = useState(profile.role)
  const [handle, setHandle] = useState(profile.handle)

  const saveProfile = () => {
    pushToast({ title: 'Profile saved', message: 'Memory updated.', tone: 'success' })
  }

  const onResetMemory = () => {
    resetMemory()
    pushToast({ title: 'Memory reset', message: 'Fresh memory graph seeded.', tone: 'success' })
  }

  return (
    <PageContainer className="p-5 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[900px]">
        <PageHeader eyebrow="Settings" title="Preferences" subtitle="Tune how STARC sounds, moves, and remembers" />

        <div className="space-y-5">
          <Section title="Profile">
            <div className="grid gap-3 py-3.5 sm:grid-cols-3">
              {[
                { label: 'Name', value: name, set: setName, ph: 'Sir' },
                { label: 'Role', value: role, set: setRole, ph: 'Principal Engineer' },
                { label: 'Handle', value: handle, set: setHandle, ph: '@sir' },
              ].map((f) => (
                <div key={f.label}>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">{f.label}</label>
                  <input
                    value={f.value}
                    onChange={(e) => f.set(e.target.value)}
                    placeholder={f.ph}
                    aria-label={f.label}
                    className="h-10 w-full rounded-[10px] border border-white/10 bg-white/[0.04] px-3 text-[13px] text-soft-white focus:outline-none"
                  />
                </div>
              ))}
            </div>
            <div className="pb-2">
              <Button size="sm" onClick={saveProfile}>Save profile</Button>
            </div>
          </Section>

          <Section title="Interface">
            <SettingRow
              icon="moon"
              title="Reduced motion"
              description={systemReducedMotion ? 'System preference detected — animations are already minimized.' : 'Disable most animation for a calmer experience.'}
              control={<Switch checked={reducedMotion} onChange={setReducedMotion} label="Reduced motion" />}
            />
            <SettingRow
              icon="gauge"
              title="Command palette"
              description="Open with ⌘K to jump between views and actions."
              control={<Button size="sm" variant="secondary" onClick={() => setCommandPaletteOpen(true)}>Open</Button>}
            />
          </Section>

          <Section title="Audio">
            <SettingRow
              icon="microphone"
              title="Sound effects"
              description="Subtle UI feedback, orb pulses, and notification chimes."
              control={<Switch checked={soundEnabled} onChange={setSoundEnabled} label="Sound effects" />}
            />
            <SettingRow
              icon="bell"
              title="Notifications"
              description="Toast alerts for automation runs, briefings, and reminders."
              control={<Switch checked onChange={() => pushToast({ title: 'Notifications stay on', message: 'This toggle is decorative in the mock build.', tone: 'info' })} label="Notifications" />}
            />
          </Section>

          <Section title="Data & Privacy">
            <SettingRow
              icon="key"
              title="Reset AI memory"
              description="Wipe stored facts, preferences, and timeline. STARC will reseed a fresh graph."
              control={<Button size="sm" variant="secondary" onClick={onResetMemory} className="text-warn">Reset memory</Button>}
            />
            <SettingRow
              icon="shield"
              title="Local-first"
              description="All data persists on this device under <span className='font-mono'>starc.memory.v1</span>. Nothing leaves your machine."
              control={<Badge tone="ok">Local</Badge>}
            />
          </Section>

          <Section title="About">
            <div className="py-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={cn('grid size-10 place-items-center rounded-xl bg-accent/10 text-accent')}>
                    <Icon name="robot" className="size-5" />
                  </span>
                  <div>
                    <p className="text-[14px] font-semibold text-soft-white">STARC · Sir's Tactical AI Research Companion</p>
                    <p className="text-[11.5px] text-muted">v2.4.1 · build 2026.08.01 · React 19 + Vite + Tailwind v4</p>
                  </div>
                </div>
                <Badge tone="accent">v2.4.1</Badge>
              </div>
              <p className="mt-4 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-[11.5px] leading-relaxed text-muted">
                Frontend build with a local mock-services layer. Swap <span className="font-mono text-silver">src/services</span> for a real backend when ready — stores already behave as the single source of truth.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setOrbMode('completed'); pushToast({ title: 'Engine nominal', message: 'All systems green.', tone: 'success' }) }}>
                  Run diagnostics
                </Button>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </PageContainer>
  )
}
