import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useChatStore } from '@/stores/chatStore'
import { QUICK_PROMPTS } from '@/stores/chatStore'
import { audioService } from '@/services/audio'
import { isSpeechSupported, speak, stopSpeaking } from '@/services/voice'
import { startVoiceTurn, type VoiceTurnHandle } from '@/services/voiceTurn'
import { stopHandsFree } from '@/services/voiceController'
import { useOrbStore } from '@/stores/orbStore'
import { useUIStore } from '@/stores/uiStore'
import { useVoiceStore } from '@/stores/voiceStore'
import {
  HiOutlineMicrophone,
  HiOutlinePaperClip,
  HiOutlineStop,
  HiOutlineSparkles,
} from 'react-icons/hi2'
import { Button } from '@/components/ui'
import { cn } from '@/utils/cn'

export function Composer({ onCompose }: { onCompose?: () => void }) {
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const streaming = useChatStore((s) => s.streaming)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const stopStreaming = useChatStore((s) => s.stopStreaming)
  const setOrbMode = useOrbStore((s) => s.setMode)
  const pushToast = useUIStore((s) => s.pushToast)
  const voiceEnabled = useVoiceStore((s) => s.enabled)
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const voiceRef = useRef<VoiceTurnHandle | null>(null)
  const partialRef = useRef('')

  const submit = async () => {
    if (!text.trim() || streaming) return
    audioService.play('activate')
    useOrbStore.getState().setPresence('thinking')
    setOrbMode('thinking')
    const value = text
    setText('')
    if (taRef.current) taRef.current.style.height = 'auto'
    const reply = await sendMessage(value)
    const settings = useVoiceStore.getState()
    if (reply && settings.enabled && settings.autoSpeak) {
      const spoke = speak(reply, {
        rate: settings.rate,
        pitch: settings.pitch,
        volume: settings.volume,
        voiceName: settings.voiceName,
        onend: () => useOrbStore.getState().setMode('monitoring'),
      })
      if (spoke) setOrbMode('speaking')
      else setOrbMode('monitoring')
    } else {
      setOrbMode('monitoring')
    }
    window.setTimeout(() => {
      useOrbStore.getState().setPresence('monitoring')
      useOrbStore.getState().setMode('monitoring')
    }, 500)
    onCompose?.()
  }

  const runVoiceTurn = () => {
    stopHandsFree()
    partialRef.current = ''
    const handle = startVoiceTurn({
      onPartial: (text) => {
        partialRef.current = text
        setText(text)
      },
    })
    if (handle) {
      voiceRef.current = handle
      setListening(true)
    } else {
      setListening(false)
    }
  }

  const toggleVoice = async () => {
    if (!voiceEnabled) {
      pushToast({
        title: 'Voice assistant is off',
        message: 'Enable it in Settings, Sir.',
        tone: 'info',
      })
      return
    }
    if (listening) {
      voiceRef.current?.stop()
      stopSpeaking()
      setListening(false)
      setOrbMode('monitoring')
      return
    }
    if (!isSpeechSupported()) {
      // Fall back to mic power-up so the orb still reacts even on unsupported browsers.
      const ok = await audioService.enableMic()
      setOrbMode('listening')
      pushToast({
        title: ok ? 'Microphone ready' : 'Voice simulation',
        message: ok ? 'Speech recognition unsupported — orb listening enabled.' : 'Simulated listening — awaiting input.',
        tone: 'info',
      })
      window.setTimeout(() => setOrbMode('monitoring'), 6000)
      return
    }
    runVoiceTurn()
  }

  return (
    <div className="border-t border-white/[0.06] bg-graphite/40 p-3 backdrop-blur-xl sm:p-4">
      <div className="mx-auto max-w-3xl">
        <div className="glass-subtle flex items-end gap-2 rounded-2xl p-2 transition-colors focus-within:border-accent/25">
          <button
            aria-label="Attach file"
            onClick={() => pushToast({ title: 'Attach', message: 'File picker connected to Workspace.', tone: 'info' })}
            className="grid size-9 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-white/[0.06] hover:text-soft-white"
          >
            <HiOutlinePaperClip className="size-4" />
          </button>

          <textarea
            ref={taRef}
            value={text}
            rows={1}
            onChange={(e) => {
              setText(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(160, e.target.scrollHeight)}px`
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="Message STARC…  ( / for commands )"
            aria-label="Message STARC"
            className="max-h-40 flex-1 resize-none bg-transparent py-2.5 text-[13.5px] leading-relaxed text-soft-white placeholder:text-muted/60 focus:outline-none"
          />

          {streaming ? (
            <Button
              variant="glass"
              size="sm"
              aria-label="Stop generating"
              onClick={() => {
                stopStreaming()
                setOrbMode('monitoring')
              }}
              className="shrink-0"
            >
              <HiOutlineStop className="size-4 text-danger" />
            </Button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              onClick={submit}
              disabled={!text.trim()}
              aria-label="Send message"
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-soft-white text-graphite shadow-glow-white transition-opacity disabled:opacity-40"
            >
              <HiOutlineSparkles className="size-4" />
            </motion.button>
          )}

          <button
            aria-label="Start microphone fallback"
            aria-pressed={listening}
            disabled={!voiceEnabled}
            onClick={toggleVoice}
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-xl transition-colors disabled:opacity-40',
              listening
                ? 'bg-accent/15 text-accent'
                : 'text-muted hover:bg-white/[0.06] hover:text-accent',
            )}
          >
            <HiOutlineMicrophone className="size-4" />
          </button>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 px-1">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setText(p.prompt)
                taRef.current?.focus()
              }}
              className="rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-muted transition-colors hover:border-accent/25 hover:text-accent"
            >
              {p.label}
            </button>
          ))}
          <span className="ml-auto hidden font-mono text-[10px] text-muted sm:block">
            Enter to send · Shift+Enter for newline
          </span>
        </div>
      </div>
    </div>
  )
}
