import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatStore } from '@/stores/chatStore'
import { useOrbStore } from '@/stores/orbStore'
import { useUIStore } from '@/stores/uiStore'
import { useVoiceStore } from '@/stores/voiceStore'

let session: {
  onResult: ((t: string) => void) | null
  onEnd: (() => void) | null
  started: boolean
  stopped: boolean
  start: (r: (t: string) => void, e: () => void) => void
  stop: () => void
} | null = null

const voice = vi.hoisted(() => ({
  createVoiceSession: vi.fn(),
  isSpeechSupported: vi.fn(),
  speak: vi.fn(),
  stopSpeaking: vi.fn(),
}))

vi.mock('@/services/voice', () => voice)

const audio = vi.hoisted(() => ({
  play: vi.fn(),
  enableMic: vi.fn().mockResolvedValue(false),
  disableMic: vi.fn(),
  getLevel: vi.fn().mockReturnValue(0),
}))
vi.mock('@/services/audio', () => ({
  audioService: { play: audio.play, enableMic: audio.enableMic, disableMic: audio.disableMic, getLevel: audio.getLevel },
}))

function makeSession() {
  session = {
    onResult: null,
    onEnd: null,
    started: false,
    stopped: false,
    start(r, e) {
      this.onResult = r
      this.onEnd = e
      this.started = true
    },
    stop() {
      this.stopped = true
    },
  }
  return session
}

function emitPartial(text: string) {
  session?.onResult?.(text)
}

function endSession() {
  session?.onEnd?.()
}

beforeEach(() => {
  session = null
  vi.clearAllMocks()
  useChatStore.setState({ streaming: false })
  useOrbStore.setState({ mode: 'monitoring', presence: 'monitoring' })
  useUIStore.setState({ toasts: [] })
  useVoiceStore.setState({
    enabled: true,
    autoSpeak: true,
    continuous: false,
    pushToTalk: true,
    rate: 1,
    pitch: 1,
    volume: 1,
    voiceName: '',
  })
  voice.isSpeechSupported.mockReturnValue(true)
  voice.createVoiceSession.mockImplementation(() => makeSession())
  voice.speak.mockReturnValue(true)
  useChatStore.setState({
    sendMessage: vi.fn().mockResolvedValue('Hello, Sir. How can I help?'),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('startVoiceTurn', () => {
  it('listens then sends the transcript and speaks the reply', async () => {
    const { startVoiceTurn } = await import('@/services/voiceTurn')
    const handle = startVoiceTurn()
    expect(handle).not.toBeNull()
    expect(session?.started).toBe(true)
    expect(useOrbStore.getState().mode).toBe('listening')

    emitPartial('Hi')
    endSession()

    await vi.waitFor(() => {
      expect(useChatStore.getState().sendMessage).toHaveBeenCalledWith('Hi')
    })
    await vi.waitFor(() => {
      expect(voice.speak).toHaveBeenCalled()
    })
    expect(useOrbStore.getState().mode).toBe('speaking')

    const [, opts] = voice.speak.mock.calls[0]
    opts?.onend?.()
    expect(useOrbStore.getState().mode).toBe('monitoring')
  })

  it('does not send chat when no speech was captured', async () => {
    const { startVoiceTurn } = await import('@/services/voiceTurn')
    startVoiceTurn()
    endSession()

    await new Promise((r) => setTimeout(r, 0))
    expect(useChatStore.getState().sendMessage).not.toHaveBeenCalled()
    expect(voice.speak).not.toHaveBeenCalled()
  })

  it('falls back to monitoring and toasts when unsupported', async () => {
    voice.isSpeechSupported.mockReturnValue(false)
    const { startVoiceTurn } = await import('@/services/voiceTurn')
    const handle = startVoiceTurn()
    expect(handle).toBeNull()
    expect(useOrbStore.getState().mode).toBe('monitoring')
    expect(useUIStore.getState().toasts.length).toBeGreaterThan(0)
  })

  it('stop() ends the session and stops speech', async () => {
    const { startVoiceTurn } = await import('@/services/voiceTurn')
    const handle = startVoiceTurn()
    handle?.stop()
    expect(session?.stopped).toBe(true)
    expect(voice.stopSpeaking).toHaveBeenCalled()
    expect(useOrbStore.getState().mode).toBe('monitoring')
  })

  it('streams partial transcripts via onPartial', async () => {
    const { startVoiceTurn } = await import('@/services/voiceTurn')
    const onPartial = vi.fn()
    startVoiceTurn({ onPartial })
    emitPartial('Hel')
    emitPartial('Hello')
    expect(onPartial).toHaveBeenNthCalledWith(1, 'Hel')
    expect(onPartial).toHaveBeenNthCalledWith(2, 'Hello')
  })

  it('refuses to start when the voice assistant is disabled', async () => {
    useVoiceStore.setState({ enabled: false })
    const { startVoiceTurn } = await import('@/services/voiceTurn')
    const handle = startVoiceTurn()
    expect(handle).toBeNull()
    expect(useOrbStore.getState().mode).toBe('monitoring')
    expect(useUIStore.getState().toasts.length).toBeGreaterThan(0)
  })

  it('does not speak when auto-speak is off but still sends the message', async () => {
    useVoiceStore.setState({ autoSpeak: false })
    const { startVoiceTurn } = await import('@/services/voiceTurn')
    startVoiceTurn()
    emitPartial('Hi')
    endSession()
    await vi.waitFor(() => {
      expect(useChatStore.getState().sendMessage).toHaveBeenCalledWith('Hi')
    })
    expect(voice.speak).not.toHaveBeenCalled()
    expect(useOrbStore.getState().mode).toBe('monitoring')
  })

  it('re-listens after the reply in continuous mode', async () => {
    useVoiceStore.setState({ continuous: true })
    vi.useFakeTimers()
    const { startVoiceTurn } = await import('@/services/voiceTurn')
    startVoiceTurn()
    emitPartial('Hi')
    endSession()
    await vi.advanceTimersByTimeAsync(0)
    expect(voice.speak).toHaveBeenCalled()
    const [, opts] = voice.speak.mock.calls[0]
    expect(voice.createVoiceSession).toHaveBeenCalledTimes(1)
    opts?.onend?.()
    await vi.advanceTimersByTimeAsync(400)
    expect(voice.createVoiceSession).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})
