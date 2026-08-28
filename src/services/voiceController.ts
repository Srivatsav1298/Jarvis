/**
 * Hands-free voice coordinator.
 *
 * Browser speech recognition is the compatibility fallback for wake-word
 * detection. Browsers do not expose a portable, local wake-word API, so this
 * path is explicitly opt-in and its limitation is reported in Settings. The
 * controller still owns one authoritative state machine and never starts two
 * recognition sessions at once.
 */
import { audioService } from '@/services/audio'
import {
  createVoiceSession,
  isSpeechRecognitionSupported,
  speak,
  stopSpeaking,
  type VoiceSession,
} from '@/services/voice'
import { suppressNextChatAutoSpeech, useChatStore } from '@/stores/chatStore'
import { useOrbStore } from '@/stores/orbStore'
import { useUIStore } from '@/stores/uiStore'
import { useVoiceStore, type VoiceInteractionState } from '@/stores/voiceStore'
import { canTransition } from '@/services/voiceStateMachine'

const WAKE_ACK = 'Yes?'
const BARGE_IN_LEVEL = 0.42

function normalized(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

class VoiceController {
  private active = false
  private session: VoiceSession | null = null
  private sessionToken = 0
  private latestTranscript = ''
  private followUpTimer: number | null = null
  private bargeTimer: number | null = null

  start(): boolean {
    const settings = useVoiceStore.getState()
    if (this.active) return true
    if (!settings.enabled || !settings.handsFree) return false
    if (!isSpeechRecognitionSupported()) {
      this.fail('This browser does not support speech recognition. Use Chrome or Edge, or use text chat.')
      return false
    }
    this.active = true
    if (settings.wakeWordEnabled) this.beginWakeListening()
    else this.beginCommandListening(false)
    return true
  }

  stop(): void {
    this.active = false
    this.sessionToken += 1
    this.clearTimers()
    this.session?.stop()
    this.session = null
    this.stopBargeMonitor()
    stopSpeaking()
    audioService.disableMic()
    this.transition('IDLE')
  }

  /** Manual activation bypasses wake-word detection while preserving cleanup. */
  startManual(): void {
    this.stopRecognitionOnly()
    this.active = true
    this.beginCommandListening(false)
  }

  private transition(next: VoiceInteractionState, message?: string): void {
    const current = useVoiceStore.getState().interactionState
    if (!canTransition(current, next)) return
    useVoiceStore.getState().setInteraction(next, message)
    const orb = useOrbStore.getState()
    const view: Record<VoiceInteractionState, { mode: Parameters<typeof orb.setMode>[0]; presence: Parameters<typeof orb.setPresence>[0] }> = {
      IDLE: { mode: 'monitoring', presence: 'monitoring' },
      LISTENING_FOR_WAKE_WORD: { mode: 'listening', presence: 'monitoring' },
      LISTENING: { mode: 'listening', presence: 'ready' },
      PROCESSING: { mode: 'thinking', presence: 'thinking' },
      SPEAKING: { mode: 'speaking', presence: 'ready' },
      FOLLOW_UP_LISTENING: { mode: 'listening', presence: 'ready' },
      ERROR: { mode: 'monitoring', presence: 'monitoring' },
    }
    orb.setMode(view[next].mode)
    orb.setPresence(view[next].presence)
  }

  private beginWakeListening(): void {
    if (!this.active) return
    this.clearFollowUpTimer()
    this.transition('LISTENING_FOR_WAKE_WORD')
    const token = ++this.sessionToken
    this.latestTranscript = ''
    this.session = createVoiceSession('en-GB', true)
    if (!this.session) return this.fail('Wake-word listening is unavailable. Use the microphone button instead.')
    this.session.start(
      (text) => {
        if (token !== this.sessionToken) return
        this.latestTranscript = text
      },
      () => {
        if (!this.active || token !== this.sessionToken) return
        this.session = null
        const transcript = this.latestTranscript
        const command = this.extractAfterWake(transcript)
        if (command === null) {
          window.setTimeout(() => this.beginWakeListening(), 120)
          return
        }
        if (command) {
          this.beginCommandListening(false, command)
        } else {
          this.acknowledgeWake()
        }
      },
      (message) => this.fail(message),
    )
  }

  private extractAfterWake(text: string): string | null {
    const phrase = normalized(useVoiceStore.getState().wakePhrase)
    const value = normalized(text)
    const aliases = [phrase]
    if (phrase.startsWith('hey ')) aliases.push(phrase.slice(4).trim())
    // SpeechRecognition commonly transcribes the brand name phonetically as
    // “stark”. Accept that pronunciation without changing the visible phrase.
    aliases.push(...aliases.map((alias) => alias.replace(/starc/g, 'stark')))
    const matched = aliases.find((alias) => alias && value.includes(alias))
    if (!matched) return null
    return value.slice(value.indexOf(matched) + matched.length).trim()
  }

  private acknowledgeWake(): void {
    this.stopRecognitionOnly()
    this.transition('LISTENING')
    const settings = useVoiceStore.getState()
    const started = speak(WAKE_ACK, {
      rate: settings.rate,
      pitch: settings.pitch,
      volume: settings.volume,
      voiceName: settings.voiceName,
      onend: () => this.beginCommandListening(false),
      onerror: () => this.beginCommandListening(false),
    })
    if (!started) this.beginCommandListening(false)
  }

  private beginCommandListening(followUp: boolean, initialText = ''): void {
    if (!this.active) return
    this.stopRecognitionOnly()
    this.clearFollowUpTimer()
    this.transition(followUp ? 'FOLLOW_UP_LISTENING' : 'LISTENING')
    this.latestTranscript = initialText
    const token = ++this.sessionToken
    this.session = createVoiceSession('en-GB', false)
    if (!this.session) return this.fail('Speech recognition is unavailable. Use text chat instead.')
    this.session.start(
      (text) => {
        if (token === this.sessionToken) this.latestTranscript = text
      },
      () => {
        if (!this.active || token !== this.sessionToken) return
        this.session = null
        const command = this.latestTranscript.trim()
        if (!command) {
          if (followUp) this.beginFollowUpTimeout()
          else this.returnToWakeOrIdle()
          return
        }
        void this.process(command)
      },
      (message) => this.fail(message),
    )
  }

  private async process(command: string): Promise<void> {
    if (!this.active) return
    this.stopRecognitionOnly()
    this.transition('PROCESSING')
    useOrbStore.getState().setPresence('thinking')
    const pushToast = useUIStore.getState().pushToast
    suppressNextChatAutoSpeech()
    const reply = await useChatStore.getState().sendMessage(command)
    if (!this.active) return
    const settings = useVoiceStore.getState()
    if (!reply || !settings.autoSpeak) {
      this.beginFollowUpOrIdle()
      return
    }
    this.transition('SPEAKING')
    const didSpeak = speak(reply, {
      rate: settings.rate,
      pitch: settings.pitch,
      volume: settings.volume,
      voiceName: settings.voiceName,
      onstart: () => this.startBargeMonitor(),
      onend: () => {
        this.stopBargeMonitor()
        this.beginFollowUpOrIdle()
      },
      onerror: (message) => {
        this.stopBargeMonitor()
        pushToast({ title: 'Voice unavailable', message, tone: 'error' })
        this.beginFollowUpOrIdle()
      },
    })
    if (!didSpeak) this.beginFollowUpOrIdle()
  }

  private startBargeMonitor(): void {
    if (!this.active || this.bargeTimer !== null) return
    void audioService.enableMic().then((ok) => {
      if (!ok || !this.active) return
      let sustained = 0
      this.bargeTimer = window.setInterval(() => {
        if (audioService.getLevel() > BARGE_IN_LEVEL) sustained += 1
        else sustained = 0
        if (sustained >= 2) {
          this.stopBargeMonitor()
          stopSpeaking()
          this.beginCommandListening(false)
        }
      }, 180)
    })
  }

  private stopBargeMonitor(): void {
    if (this.bargeTimer !== null) window.clearInterval(this.bargeTimer)
    this.bargeTimer = null
    audioService.disableMic()
  }

  private beginFollowUpOrIdle(): void {
    const settings = useVoiceStore.getState()
    if (settings.followUpEnabled) this.beginCommandListening(true)
    else this.returnToWakeOrIdle()
  }

  private beginFollowUpTimeout(): void {
    this.clearFollowUpTimer()
    this.followUpTimer = window.setTimeout(() => this.returnToWakeOrIdle(), useVoiceStore.getState().followUpTimeoutSeconds * 1000)
  }

  private returnToWakeOrIdle(): void {
    if (!this.active) return
    this.clearTimers()
    if (useVoiceStore.getState().wakeWordEnabled) this.beginWakeListening()
    else {
      this.active = false
      this.transition('IDLE')
    }
  }

  private stopRecognitionOnly(): void {
    this.sessionToken += 1
    this.session?.stop()
    this.session = null
  }

  private clearFollowUpTimer(): void {
    if (this.followUpTimer !== null) window.clearTimeout(this.followUpTimer)
    this.followUpTimer = null
  }

  private clearTimers(): void {
    this.clearFollowUpTimer()
    if (this.bargeTimer !== null) window.clearInterval(this.bargeTimer)
    this.bargeTimer = null
  }

  private fail(message: string): void {
    this.active = false
    this.stopRecognitionOnly()
    this.clearTimers()
    audioService.disableMic()
    this.transition('ERROR', message)
    useUIStore.getState().pushToast({ title: 'Hands-free voice', message, tone: 'error' })
    window.setTimeout(() => this.transition('IDLE'), 2500)
  }
}

export const voiceController = new VoiceController()
export const startHandsFree = () => voiceController.start()
export const stopHandsFree = () => voiceController.stop()
export const startManualVoice = () => voiceController.startManual()
