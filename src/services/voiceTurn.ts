/** Full voice turn: listen (STT) -> send to chat -> speak reply (TTS).
 *
 * Shared by the Composer mic button, the Overview Quick Actions and the
 * command palette so every entry point runs the real Web Speech flow instead
 * of a simulated orb animation.
 *
 * Settings come from voiceStore (localStorage-persisted): autoSpeak,
 * continuous conversation mode, push-to-talk, and TTS prosody.
 */

import { audioService } from '@/services/audio'
import {
  createVoiceSession,
  isSpeechSupported,
  speak,
  stopSpeaking,
  type VoiceSession,
} from '@/services/voice'
import { suppressNextChatAutoSpeech, useChatStore } from '@/stores/chatStore'
import { useOrbStore } from '@/stores/orbStore'
import { useUIStore } from '@/stores/uiStore'
import { useVoiceStore } from '@/stores/voiceStore'

export interface VoiceTurnOptions {
  /** Stream interim/final transcripts into a text field while listening. */
  onPartial?: (text: string) => void
}

export interface VoiceTurnHandle {
  stop: () => void
}

/** Mic amplitude above this (0..1) for 180ms while speaking = barge-in. */
const BARGE_IN_THRESHOLD = 0.4

const activeHandles = new Set<VoiceTurnHandle>()

/** Stop every active voice turn (used by global Escape + master switch). */
export function stopAllVoice(): void {
  for (const handle of [...activeHandles]) {
    handle.stop()
  }
  activeHandles.clear()
  stopSpeaking()
}

/** Start listening; on a final transcript send it to chat and speak the reply. */
export function startVoiceTurn(options: VoiceTurnOptions = {}): VoiceTurnHandle | null {
  const setOrbMode = useOrbStore.getState().setMode
  const setPresence = useOrbStore.getState().setPresence
  const pushToast = useUIStore.getState().pushToast
  const sendMessage = useChatStore.getState().sendMessage

  if (!useVoiceStore.getState().enabled) {
    pushToast({
      title: 'Voice assistant is off',
      message: 'Enable it in Settings, Sir.',
      tone: 'info',
    })
    setOrbMode('monitoring')
    return null
  }

  if (!isSpeechSupported()) {
    pushToast({
      title: 'Voice unavailable',
      message: 'Speech recognition is not supported in this browser, Sir.',
      tone: 'error',
    })
    setOrbMode('monitoring')
    return null
  }

  // Barge-in: if Starc is mid-sentence, stop the audio immediately.
  stopSpeaking()

  let active = true
  let currentSession: VoiceSession | null = null
  let partial = ''
  let bargeTimer: number | null = null

  const clearBargeTimer = () => {
    if (bargeTimer !== null) {
      window.clearInterval(bargeTimer)
      bargeTimer = null
    }
  }

  const runTurn = async (spoken: string) => {
    if (!active) return
    setPresence('thinking')
    setOrbMode('thinking')
    audioService.play('activate')
    // Voice turns own the speech lifecycle so barge-in and continuous mode can
    // react to onstart/onend without a second auto-speech queue.
    suppressNextChatAutoSpeech()
    const reply = await sendMessage(spoken)
    if (!active) return
    setPresence('ready')

    const settings = useVoiceStore.getState()
    const shouldSpeak = !!reply && settings.enabled && settings.autoSpeak
    if (!shouldSpeak) {
      if (settings.continuous) {
        window.setTimeout(listen, 250)
      } else {
        setOrbMode('monitoring')
      }
      return
    }

    setOrbMode('speaking')
    speak(reply, {
      rate: settings.rate,
      pitch: settings.pitch,
      volume: settings.volume,
      voiceName: settings.voiceName,
      // Arm the barge-in mic only when the reply is actually audible — so the
      // assistant's own voice can't instantly cancel itself (self-interrupt).
      onstart: () => {
        if (active) startBargeMonitor()
      },
      onend: () => {
        if (!active) return
        clearBargeTimer()
        audioService.disableMic()
        if (useVoiceStore.getState().continuous) {
          window.setTimeout(listen, 250)
        } else {
          setOrbMode('monitoring')
        }
      },
      onerror: (message) => {
        if (!active) return
        clearBargeTimer()
        audioService.disableMic()
        pushToast({ title: 'Voice unavailable', message, tone: 'error' })
        setOrbMode('monitoring')
      },
    })
  }

  const listen = () => {
    if (!active) return
    // Already listening — don't stack a second recognition session (a barge
    // cancel and the utterance onend can both schedule a fresh listen).
    if (currentSession) return
    partial = ''
    currentSession = createVoiceSession('en-GB', !useVoiceStore.getState().pushToTalk)
    if (!currentSession) {
      active = false
      setOrbMode('monitoring')
      pushToast({
        title: 'Voice unavailable',
        message: 'Could not start the microphone, Sir.',
        tone: 'error',
      })
      return
    }
    setOrbMode('listening')
    audioService.play('listen')

    currentSession.start(
      (text) => {
        partial = text
        options.onPartial?.(text)
      },
      () => {
        if (!active) return
        currentSession = null
        clearBargeTimer()
        const spoken = partial.trim()
        if (!spoken) {
          if (useVoiceStore.getState().continuous) {
            window.setTimeout(listen, 400)
          } else {
            setOrbMode('monitoring')
          }
          return
        }
        void runTurn(spoken)
      },
      (message) => {
        if (!active) return
        pushToast({ title: 'Microphone issue', message, tone: 'error' })
        setOrbMode('monitoring')
      },
    )
  }

  // While Starc speaks, keep an ear open: a loud mic burst interrupts the
  // audio and starts a fresh recognition (spec §9 — natural barge-in).
  // Only armed once the reply has started, and requires two consecutive
  // loud reads (~360ms) so Starc's own voice bleeding into the mic can't
  // trigger an instant self-interrupt.
  const startBargeMonitor = () => {
    if (!active) return
    void audioService.enableMic().then((ok) => {
      if (!ok || !active) return
      clearBargeTimer()
      let sustainedLevels = 0
      bargeTimer = window.setInterval(() => {
        if (!active) return
        if (audioService.getLevel() > BARGE_IN_THRESHOLD) {
          sustainedLevels += 1
          if (sustainedLevels < 2) return
          clearBargeTimer()
          audioService.disableMic()
          stopSpeaking()
          pushToast({ title: 'Interrupted', message: 'Go ahead, Sir.', tone: 'info' })
          window.setTimeout(listen, 200)
        } else {
          sustainedLevels = 0
        }
      }, 180)
    })
  }

  listen()

  const handle: VoiceTurnHandle = {
    stop: () => {
      if (!active) return
      active = false
      clearBargeTimer()
      currentSession?.stop()
      currentSession = null
      stopSpeaking()
      audioService.disableMic()
      setOrbMode('monitoring')
      activeHandles.delete(handle)
    },
  }
  activeHandles.add(handle)
  return handle
}
