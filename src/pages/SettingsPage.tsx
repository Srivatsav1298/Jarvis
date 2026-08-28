import { useEffect, useState } from 'react'
import { PageContainer, PageHeader } from '@/features/shared/PageContainer'
import { useUIStore } from '@/stores/uiStore'
import { useMemoryStore } from '@/stores/memoryStore'
import { useOrbStore } from '@/stores/orbStore'
import { useVoiceStore } from '@/stores/voiceStore'
import { Badge, Button, Card, Icon, Slider, Switch } from '@/components/ui'
import { cn } from '@/utils/cn'
import { isSpeechRecognitionSupported, listVoices, speak, type VoiceDescriptor } from '@/services/voice'
import { stopAllVoice } from '@/services/voiceTurn'
import { startHandsFree, stopHandsFree } from '@/services/voiceController'

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

  const voiceEnabled = useVoiceStore((s) => s.enabled)
  const voiceAutoSpeak = useVoiceStore((s) => s.autoSpeak)
  const voiceContinuous = useVoiceStore((s) => s.continuous)
  const handsFree = useVoiceStore((s) => s.handsFree)
  const wakeWordEnabled = useVoiceStore((s) => s.wakeWordEnabled)
  const wakePhrase = useVoiceStore((s) => s.wakePhrase)
  const followUpEnabled = useVoiceStore((s) => s.followUpEnabled)
  const followUpTimeoutSeconds = useVoiceStore((s) => s.followUpTimeoutSeconds)
  const voicePushToTalk = useVoiceStore((s) => s.pushToTalk)
  const voiceRate = useVoiceStore((s) => s.rate)
  const voicePitch = useVoiceStore((s) => s.pitch)
  const voiceVolume = useVoiceStore((s) => s.volume)
  const voiceName = useVoiceStore((s) => s.voiceName)
  const setVoiceEnabled = useVoiceStore((s) => s.setEnabled)
  const setVoiceAutoSpeak = useVoiceStore((s) => s.setAutoSpeak)
  const setVoiceContinuous = useVoiceStore((s) => s.setContinuous)
  const setHandsFree = useVoiceStore((s) => s.setHandsFree)
  const setWakeWordEnabled = useVoiceStore((s) => s.setWakeWordEnabled)
  const setWakePhrase = useVoiceStore((s) => s.setWakePhrase)
  const setFollowUpEnabled = useVoiceStore((s) => s.setFollowUpEnabled)
  const setFollowUpTimeoutSeconds = useVoiceStore((s) => s.setFollowUpTimeoutSeconds)
  const setVoicePushToTalk = useVoiceStore((s) => s.setPushToTalk)
  const setVoiceRate = useVoiceStore((s) => s.setRate)
  const setVoicePitch = useVoiceStore((s) => s.setPitch)
  const setVoiceVolume = useVoiceStore((s) => s.setVolume)
  const setVoiceName = useVoiceStore((s) => s.setVoiceName)

  const [voices, setVoices] = useState<VoiceDescriptor[]>([])
  useEffect(() => {
    const refresh = () => setVoices(listVoices())
    refresh()
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
    synth?.addEventListener?.('voiceschanged', refresh)
    const timer = window.setTimeout(refresh, 600)
    return () => {
      synth?.removeEventListener?.('voiceschanged', refresh)
      window.clearTimeout(timer)
    }
  }, [])

  // British voices first, then other English, then the rest (spec §6).
  const sortedVoices = [...voices].sort((a, b) => {
    const score = (v: VoiceDescriptor) => {
      const lang = v.lang.toLowerCase()
      const british = lang.startsWith('en-gb') || lang.startsWith('en_gb') || v.name.toLowerCase().includes('british') || v.name.toLowerCase().includes('uk english')
      const english = lang.startsWith('en')
      return british ? 0 : english ? 1 : 2
    }
    return score(a) - score(b) || a.name.localeCompare(b.name)
  })
  const noVoices = voices.length === 0
  const speechSupported = isSpeechRecognitionSupported()
  const activeVoice = voiceName
    ? voices.find((voice) => voice.name === voiceName)
    : sortedVoices.find((voice) => voice.lang.toLowerCase().startsWith('en-gb')) ?? sortedVoices.find((voice) => voice.lang.toLowerCase().startsWith('en'))

  const testVoice = () => {
    if (!voiceEnabled) {
      pushToast({ title: 'Voice assistant is off', message: 'Enable it first, Sir.', tone: 'warning' })
      return
    }
    setOrbMode('speaking')
    speak("Hello. I'm Starc. How can I help you today?", {
      rate: voiceRate,
      pitch: voicePitch,
      volume: voiceVolume,
      voiceName,
      onend: () => useOrbStore.getState().setMode('monitoring'),
    })
  }

  const toggleMasterVoice = (v: boolean) => {
    if (!v) {
      stopAllVoice()
      stopHandsFree()
    }
    setVoiceEnabled(v)
  }

  const toggleHandsFree = (v: boolean) => {
    setHandsFree(v)
    if (v && voiceEnabled) startHandsFree()
    else stopHandsFree()
  }

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

          <Section title="Voice Assistant">
            <SettingRow
              icon="microphone"
              title="Voice assistant"
              description="Speak to Starc and hear replies in a British English voice."
              control={<Switch checked={voiceEnabled} onChange={toggleMasterVoice} label="Voice assistant" />}
            />
            <SettingRow
              icon="sparkles"
              title="Hands-free voice"
              description={speechSupported ? "Listen for ‘Hey Starc’ or ‘Starc’ after the first microphone permission is granted." : 'This browser does not expose speech recognition. Use Chrome or Edge for hands-free voice; text chat remains available.'}
              control={<Switch checked={handsFree} onChange={toggleHandsFree} label="Hands-free voice" />}
            />
            <SettingRow
              icon="radio"
              title="Wake word"
              description="Browser fallback listens for the configured phrase; audio is handled by the browser until activation."
              control={<Switch checked={wakeWordEnabled} onChange={setWakeWordEnabled} label="Wake word" />}
            />
            <SettingRow
              icon="chat"
              title="Wake phrase"
              description="The phrase that activates Jarvis hands-free."
              control={<input value={wakePhrase} onChange={(e) => setWakePhrase(e.target.value)} aria-label="Wake phrase" className="h-8 w-36 rounded-[10px] border border-white/10 bg-white/[0.04] px-2 text-[12px] text-soft-white focus:outline-none" />}
            />
            <SettingRow
              icon="chat"
              title="Auto-speak responses"
              description="Read assistant replies aloud after every message."
              control={<Switch checked={voiceAutoSpeak} onChange={setVoiceAutoSpeak} label="Auto-speak responses" />}
            />
            <SettingRow
              icon="refresh"
              title="Continuous conversation"
              description="Starc speaks, then listens again automatically for a hands-free back-and-forth."
              control={<Switch checked={voiceContinuous} onChange={setVoiceContinuous} label="Continuous conversation" />}
            />
            <SettingRow
              icon="refresh"
              title="Follow-up listening"
              description="Keep listening briefly after Starc speaks so you can ask a follow-up without repeating the wake phrase."
              control={<Switch checked={followUpEnabled} onChange={setFollowUpEnabled} label="Follow-up listening" />}
            />
            <SettingRow
              icon="hand"
              title="Push to talk"
              description="Off keeps the microphone open across phrases until you stop it."
              control={<Switch checked={voicePushToTalk} onChange={setVoicePushToTalk} label="Push to talk" />}
            />
            <SettingRow
              icon="mic"
              title="Voice"
              description={noVoices ? 'No system voices found — Starc will re-check after the browser loads them.' : `Active: ${activeVoice?.name ?? 'browser default'} · ${activeVoice?.lang ?? 'unknown language'}`}
              control={
                <select
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  aria-label="Voice"
                  disabled={noVoices}
                  className="h-8 max-w-[220px] rounded-[10px] border border-white/10 bg-white/[0.04] px-2 text-[12.5px] text-soft-white focus:outline-none disabled:opacity-50"
                >
                  <option value="">Auto — best available</option>
                  {sortedVoices.map((v) => (
                    <option key={`${v.name}:${v.lang}`} value={v.name}>
                      {v.name} · {v.lang}
                    </option>
                  ))}
                </select>
              }
            />
            <SettingRow
              icon="status"
              title="Voice status"
              description={noVoices ? 'Waiting for the browser to expose speech voices.' : activeVoice?.lang.toLowerCase().startsWith('en-gb') ? 'British English voice ready.' : 'British voice unavailable; using the best English fallback.'}
              control={<Badge tone={noVoices ? 'warn' : activeVoice?.lang.toLowerCase().startsWith('en-gb') ? 'ok' : 'accent'}>{noVoices ? 'Waiting' : activeVoice?.lang.toLowerCase().startsWith('en-gb') ? 'Ready' : 'Fallback'}</Badge>}
            />
            <div className="space-y-3.5 py-3.5">
              {[
                { label: 'Speech speed', value: voiceRate, min: 0.5, max: 2, step: 0.05, set: setVoiceRate },
                { label: 'Pitch', value: voicePitch, min: 0.5, max: 2, step: 0.05, set: setVoicePitch },
                { label: 'Volume', value: voiceVolume, min: 0, max: 1, step: 0.05, set: setVoiceVolume },
              ].map((s) => (
                <div key={s.label}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-[11.5px] font-medium text-silver">{s.label}</label>
                    <span className="font-mono text-[11px] text-muted">{s.value.toFixed(2)}</span>
                  </div>
                  <Slider
                    aria-label={s.label}
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={s.value}
                    onChange={(e) => s.set(Number(e.target.value))}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-4 py-3.5">
              <div>
                <p className="text-[11.5px] font-medium text-silver">Follow-up timeout</p>
                <p className="text-[11px] text-muted">How long Jarvis waits for another request.</p>
              </div>
              <select
                value={followUpTimeoutSeconds}
                onChange={(e) => setFollowUpTimeoutSeconds(Number(e.target.value))}
                aria-label="Follow-up timeout"
                className="h-8 rounded-[10px] border border-white/10 bg-white/[0.04] px-2 text-[12px] text-soft-white focus:outline-none"
              >
                {[5, 6, 7, 8, 9, 10].map((seconds) => <option key={seconds} value={seconds}>{seconds} seconds</option>)}
              </select>
            </div>
            <SettingRow
              icon="play"
              title="Test voice"
              description='Plays "Hello. I’m Starc. How can I help you today?"'
              control={
                <Button size="sm" variant="secondary" onClick={testVoice} disabled={!voiceEnabled}>
                  Test voice
                </Button>
              }
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
