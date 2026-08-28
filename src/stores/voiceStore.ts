import { create } from 'zustand'

/**
 * Voice Assistant settings. Persisted to localStorage (no backend round-trip)
 * so preferences survive reloads and stay local-first.
 *
 * `voiceName` is the exact SpeechSynthesisVoice.name the user picked, or ''
 * for automatic British-voice ranking.
 */

export interface VoiceSettings {
  enabled: boolean
  autoSpeak: boolean
  continuous: boolean
  handsFree: boolean
  wakeWordEnabled: boolean
  wakePhrase: string
  followUpEnabled: boolean
  followUpTimeoutSeconds: number
  pushToTalk: boolean
  rate: number
  pitch: number
  volume: number
  voiceName: string
}

export interface VoiceStoreState extends VoiceSettings {
  setEnabled: (v: boolean) => void
  setAutoSpeak: (v: boolean) => void
  setContinuous: (v: boolean) => void
  setHandsFree: (v: boolean) => void
  setWakeWordEnabled: (v: boolean) => void
  setWakePhrase: (v: string) => void
  setFollowUpEnabled: (v: boolean) => void
  setFollowUpTimeoutSeconds: (v: number) => void
  setPushToTalk: (v: boolean) => void
  setRate: (v: number) => void
  setPitch: (v: number) => void
  setVolume: (v: number) => void
  setVoiceName: (v: string) => void
  interactionState: VoiceInteractionState
  interactionMessage: string
  setInteraction: (state: VoiceInteractionState, message?: string) => void
  reset: () => void
}

export type VoiceInteractionState =
  | 'IDLE'
  | 'LISTENING_FOR_WAKE_WORD'
  | 'LISTENING'
  | 'PROCESSING'
  | 'SPEAKING'
  | 'FOLLOW_UP_LISTENING'
  | 'ERROR'

const STORAGE_KEY = 'starc.voice.v1'

const DEFAULTS: VoiceSettings = {
  enabled: true,
  autoSpeak: true,
  continuous: false,
  handsFree: true,
  wakeWordEnabled: true,
  wakePhrase: 'Hey Starc',
  followUpEnabled: true,
  followUpTimeoutSeconds: 7,
  pushToTalk: true,
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  voiceName: '',
}

function readStored(): VoiceSettings {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<VoiceSettings>
    if (parsed.wakePhrase?.toLowerCase() === 'hey jarvis' || parsed.wakePhrase?.toLowerCase() === 'jarvis') {
      parsed.wakePhrase = DEFAULTS.wakePhrase
    }
    return { ...DEFAULTS, ...parsed }
  } catch {
    return DEFAULTS
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export const useVoiceStore = create<VoiceStoreState>()((set, get) => {
  const persist = (patch: Partial<VoiceSettings>) => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(patch))
      } catch {
        // storage unavailable — keep in-memory settings
      }
    }
  }

  const initial = readStored()

  return {
    ...initial,
    interactionState: 'IDLE',
    interactionMessage: "Say ‘Hey Starc’ or ‘Starc’",

    setEnabled: (enabled) => {
      const patch = { ...get(), enabled }
      set(patch)
      persist(patch)
    },
    setAutoSpeak: (autoSpeak) => {
      const patch = { ...get(), autoSpeak }
      set(patch)
      persist(patch)
    },
    setContinuous: (continuous) => {
      const patch = { ...get(), continuous }
      set(patch)
      persist(patch)
    },
    setHandsFree: (handsFree) => {
      const patch = { ...get(), handsFree }
      set(patch)
      persist(patch)
    },
    setWakeWordEnabled: (wakeWordEnabled) => {
      const patch = { ...get(), wakeWordEnabled }
      set(patch)
      persist(patch)
    },
    setWakePhrase: (wakePhrase) => {
      const patch = { ...get(), wakePhrase: wakePhrase.trim() || DEFAULTS.wakePhrase }
      set(patch)
      persist(patch)
    },
    setFollowUpEnabled: (followUpEnabled) => {
      const patch = { ...get(), followUpEnabled }
      set(patch)
      persist(patch)
    },
    setFollowUpTimeoutSeconds: (value) => {
      const followUpTimeoutSeconds = clamp(value, 5, 10)
      const patch = { ...get(), followUpTimeoutSeconds }
      set(patch)
      persist(patch)
    },
    setPushToTalk: (pushToTalk) => {
      const patch = { ...get(), pushToTalk }
      set(patch)
      persist(patch)
    },
    setRate: (rate) => {
      const patch = { ...get(), rate: clamp(rate, 0.5, 2) }
      set(patch)
      persist(patch)
    },
    setPitch: (pitch) => {
      const patch = { ...get(), pitch: clamp(pitch, 0.5, 2) }
      set(patch)
      persist(patch)
    },
    setVolume: (volume) => {
      const patch = { ...get(), volume: clamp(volume, 0, 1) }
      set(patch)
      persist(patch)
    },
    setVoiceName: (voiceName) => {
      const patch = { ...get(), voiceName }
      set(patch)
      persist(patch)
    },
    setInteraction: (interactionState, interactionMessage) =>
      set({
        interactionState,
        interactionMessage:
          interactionMessage ??
          ({
            IDLE: "Say ‘Hey Starc’ or ‘Starc’",
            LISTENING_FOR_WAKE_WORD: 'Listening for wake word',
            LISTENING: 'Jarvis is listening',
            PROCESSING: 'Jarvis is processing your request',
            SPEAKING: 'Jarvis is speaking',
            FOLLOW_UP_LISTENING: 'Ready for another request',
            ERROR: 'Voice needs attention',
          } satisfies Record<VoiceInteractionState, string>)[interactionState],
      }),
    reset: () => {
      const patch = { ...DEFAULTS }
      set(patch)
      persist(patch)
    },
  }
})
