import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Minimal SpeechSynthesisUtterance + speechSynthesis stub.
class FakeUtterance {
  text: string
  lang = ''
  rate = 1
  pitch = 1
  voice: unknown = null
  onend: (() => void) | null = null
  onstart: (() => void) | null = null
  constructor(text: string) {
    this.text = text
  }
}

const spoken: FakeUtterance[] = []
const synthesis = {
  getVoices: vi.fn(),
  speak: vi.fn((u: FakeUtterance) => spoken.push(u)),
  cancel: vi.fn(),
  speaking: false,
  paused: false,
  resume: vi.fn(),
}

function installSpeechSynthesis() {
  ;(globalThis as Record<string, unknown>).SpeechSynthesisUtterance = FakeUtterance
  ;(globalThis as Record<string, unknown>).speechSynthesis = synthesis
}

function uninstallSpeechSynthesis() {
  delete (globalThis as Record<string, unknown>).speechSynthesis
  delete (globalThis as Record<string, unknown>).SpeechSynthesisUtterance
}

// Fake SpeechRecognition for createVoiceSession tests.
const recognitionInstances: FakeRecognition[] = []
class FakeRecognition {
  lang = ''
  continuous = false
  interimResults = true
  maxAlternatives = 1
  onresult: ((event: unknown) => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  started = false
  constructor() {
    recognitionInstances.push(this)
  }
  start() {
    this.started = true
  }
  stop() {
    this.onend?.()
  }
  abort() {}
}

function installRecognition() {
  recognitionInstances.length = 0
  ;(globalThis as Record<string, unknown>).SpeechRecognition = FakeRecognition
  ;(globalThis as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition
}

// "window" lives on globalThis in vitest's node env; voice.ts checks `window` first.
const realWindow = globalThis.window

beforeEach(async () => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  installSpeechSynthesis()
  spoken.length = 0
  synthesis.speaking = false
  synthesis.paused = false
  synthesis.getVoices.mockReturnValue([
    { name: 'Google UK English Female', lang: 'en-GB', voiceURI: 'x', default: true, localService: true },
    { name: 'Samantha', lang: 'en-US', voiceURI: 'y', default: false, localService: true },
  ])
  // Reset module-level speech state (lastSpoken/pendingText/queue) between tests.
  const { stopSpeaking } = await import('@/services/voice')
  stopSpeaking()
})

afterEach(() => {
  vi.useRealTimers()
  uninstallSpeechSynthesis()
  vi.restoreAllMocks()
})

describe('voice.cleanTextForSpeech', () => {
  it('strips markdown formatting and deduplicates repeated words/phrases', async () => {
    const { cleanTextForSpeech } = await import('@/services/voice')
    const raw = '**Hello** world world, [link](http://ex.com) `code` # Header'
    expect(cleanTextForSpeech(raw)).toBe('Hello world, link code Header')
  })

  it('deduplicates repeated phrases in speech text', async () => {
    const { cleanTextForSpeech } = await import('@/services/voice')
    const text = 'what time is it what time is it'
    expect(cleanTextForSpeech(text)).toBe('what time is it')
  })

  it('deduplicates repeated words with punctuation between them', async () => {
    const { cleanTextForSpeech } = await import('@/services/voice')
    expect(cleanTextForSpeech('How can I help first? first.')).toBe('How can I help first.')
    expect(cleanTextForSpeech('All systems nominal, Sir. Sir.')).toBe('All systems nominal, Sir.')
  })
})

describe('voice.speak', () => {
  it('defers speak() to a later task (Chrome cancel/speak race fix)', async () => {
    const { speak } = await import('@/services/voice')
    const ok = speak('hello')
    expect(ok).toBe(true)
    // Not spoken synchronously — the speak is deferred.
    expect(synthesis.speak).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(100)
    expect(synthesis.speak).toHaveBeenCalledTimes(1)
    expect(spoken[0]?.text).toBe('hello')
  })

  it('cancels an in-flight utterance before speaking a new one', async () => {
    synthesis.speaking = true
    const { speak } = await import('@/services/voice')
    speak('second')
    await vi.advanceTimersByTimeAsync(300)
    expect(synthesis.cancel).toHaveBeenCalled()
    expect(synthesis.speak).toHaveBeenCalledTimes(1)
    expect(spoken[0]?.text).toBe('second')
  })

  it('prefers a British English voice', async () => {
    const { speak } = await import('@/services/voice')
    speak('Good morning')
    await vi.advanceTimersByTimeAsync(100)
    const u = spoken[0]
    expect(u?.voice).toEqual({ name: 'Google UK English Female', lang: 'en-GB', voiceURI: 'x', default: true, localService: true })
    expect(u?.lang).toBe('en-GB')
  })

  it('selects preferred British voice Daniel over default generic voice', async () => {
    synthesis.getVoices.mockReturnValue([
      { name: 'Generic Voice', lang: 'en-GB', voiceURI: 'a', default: true, localService: true },
      { name: 'Daniel', lang: 'en-GB', voiceURI: 'b', default: false, localService: true },
    ])
    const { speak } = await import('@/services/voice')
    speak('Hello Sir')
    await vi.advanceTimersByTimeAsync(100)
    const u = spoken[0]
    expect(u?.voice).toEqual({ name: 'Daniel', lang: 'en-GB', voiceURI: 'b', default: false, localService: true })
  })

  it('falls back to an English voice when no British voice exists', async () => {
    synthesis.getVoices.mockReturnValue([
      { name: 'Samantha', lang: 'en-US', voiceURI: 'y', default: false, localService: true },
    ])
    const { speak } = await import('@/services/voice')
    speak('hello')
    await vi.advanceTimersByTimeAsync(100)
    expect(spoken[0]?.voice).toEqual({ name: 'Samantha', lang: 'en-US', voiceURI: 'y', default: false, localService: true })
  })

  it('returns false when speechSynthesis is unavailable', async () => {
    uninstallSpeechSynthesis()
    const { speak } = await import('@/services/voice')
    expect(speak('hello')).toBe(false)
  })

  it('fires onend after the utterance completes', async () => {
    const { speak } = await import('@/services/voice')
    const onend = vi.fn()
    speak('done', { onend })
    await vi.advanceTimersByTimeAsync(100)
    const u = spoken[0]
    u?.onend?.()
    expect(onend).toHaveBeenCalled()
  })

  it('speaks identical text only once (no repeated words)', async () => {
    const { speak } = await import('@/services/voice')
    speak('repeat this phrase')
    speak('repeat this phrase')
    await vi.advanceTimersByTimeAsync(300)
    expect(synthesis.speak).toHaveBeenCalledTimes(1)
    expect(spoken[0]?.text).toBe('repeat this phrase')
  })

  it('speaks the same text again after the first utterance ends', async () => {
    const { speak } = await import('@/services/voice')
    speak('say this once')
    await vi.advanceTimersByTimeAsync(300)
    spoken[0]?.onend?.()
    speak('say this once')
    await vi.advanceTimersByTimeAsync(300)
    expect(synthesis.speak).toHaveBeenCalledTimes(2)
  })
})

describe('voice.createVoiceSession', () => {
  const fireResult = (rec: FakeRecognition, results: Array<{ transcript: string; final: boolean }>) => {
    const list = results.map((r) => ({
      isFinal: r.final,
      0: { transcript: r.transcript },
      length: 1,
    }))
    ;(rec.onresult as ((e: unknown) => void) | null)?.({ resultIndex: 0, results: list })
  }

  it('does not double the final transcript when Chrome re-fires the same result', async () => {
    installRecognition()
    const { createVoiceSession } = await import('@/services/voice')
    const session = createVoiceSession()
    expect(session).not.toBeNull()
    const seen: string[] = []
    session!.start((t) => seen.push(t), () => {})
    const rec = recognitionInstances[0]
    expect(rec).toBeDefined()
    // Re-firing the identical final (Chrome behavior) must not append twice.
    fireResult(rec, [{ transcript: 'what time is it', final: true }])
    fireResult(rec, [{ transcript: 'what time is it', final: true }])
    expect(seen[seen.length - 1]).toBe('what time is it')
    expect(seen.filter((t) => t === 'what time is it')).toHaveLength(1)
  })

  it('sets continuous from the push-to-talk setting', async () => {
    installRecognition()
    const { createVoiceSession } = await import('@/services/voice')
    createVoiceSession('en-GB', true)
    expect(recognitionInstances[0]?.continuous).toBe(true)
  })
})

describe('voice.chunkSpeech', () => {
  it('keeps a short reply as a single chunk', async () => {
    const { chunkSpeech } = await import('@/services/voice')
    expect(chunkSpeech('Good morning, Sir.')).toEqual(['Good morning, Sir.'])
  })

  it('splits long multi-sentence replies into natural chunks', async () => {
    const { chunkSpeech } = await import('@/services/voice')
    const text =
      'First sentence here. Second sentence here. Third sentence here. Fourth sentence here. Fifth sentence here.'
    const chunks = chunkSpeech(text)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toBe(text.replace(/\s+/g, ' '))
  })
})

describe('voice.speak options', () => {
  it('honours an explicitly selected voice', async () => {
    const { speak } = await import('@/services/voice')
    speak('hello', { voiceName: 'Samantha' })
    await vi.advanceTimersByTimeAsync(100)
    expect(spoken[0]?.voice).toEqual({ name: 'Samantha', lang: 'en-US', voiceURI: 'y', default: false, localService: true })
  })

  it('applies rate, pitch and volume to the utterance', async () => {
    const { speak } = await import('@/services/voice')
    speak('hello', { rate: 1.2, pitch: 0.9, volume: 0.7 })
    await vi.advanceTimersByTimeAsync(100)
    const u = spoken[0] as unknown as { rate: number; pitch: number; volume: number }
    expect(u.rate).toBe(1.2)
    expect(u.pitch).toBe(0.9)
    expect(u.volume).toBe(0.7)
  })

  it('prefers any English voice over a foreign one when no British exists', async () => {
    synthesis.getVoices.mockReturnValue([
      { name: 'Amélie', lang: 'fr-FR', voiceURI: 'f', default: false, localService: true },
      { name: 'Samantha', lang: 'en-US', voiceURI: 'y', default: false, localService: true },
    ])
    const { speak } = await import('@/services/voice')
    speak('hello')
    await vi.advanceTimersByTimeAsync(100)
    expect(spoken[0]?.voice).toEqual({ name: 'Samantha', lang: 'en-US', voiceURI: 'y', default: false, localService: true })
  })

  it('speaks a long reply in sequential chunks', async () => {
    const { speak } = await import('@/services/voice')
    const text =
      'One sentence here. Two sentence here. Three sentence here. Four sentence here.'
    speak(text)
    await vi.advanceTimersByTimeAsync(100)
    // First chunk only — later chunks queue until the first finishes.
    expect(synthesis.speak).toHaveBeenCalledTimes(1)
    spoken[0]?.onend?.()
    await vi.advanceTimersByTimeAsync(100)
    expect(synthesis.speak).toHaveBeenCalledTimes(2)
  })

  it('fires onstart exactly once for the whole reply (first chunk only)', async () => {
    const { speak } = await import('@/services/voice')
    const onstart = vi.fn()
    const text =
      'One sentence here. Two sentence here. Three sentence here. Four sentence here.'
    speak(text, { onstart })
    await vi.advanceTimersByTimeAsync(100)
    spoken[0]?.onstart?.()
    expect(onstart).toHaveBeenCalledTimes(1)
    spoken[0]?.onend?.()
    await vi.advanceTimersByTimeAsync(100)
    spoken[1]?.onstart?.()
    // Second chunk is a continuation — no second start report.
    expect(onstart).toHaveBeenCalledTimes(1)
  })

  it('re-speaks identical text after a chunked reply fully drains', async () => {
    const { speak } = await import('@/services/voice')
    const text =
      'One sentence here. Two sentence here. Three sentence here. Four sentence here.'
    speak(text)
    await vi.advanceTimersByTimeAsync(100)
    // 3-sentence cap => 2 chunks ("One. Two. Three." then "Four.").
    expect(synthesis.speak).toHaveBeenCalledTimes(1)
    spoken[0]?.onend?.()
    await vi.advanceTimersByTimeAsync(100)
    expect(synthesis.speak).toHaveBeenCalledTimes(2)
    spoken[1]?.onend?.()
    await vi.advanceTimersByTimeAsync(100)
    // Queue fully drained — identical text may be spoken again.
    speak(text)
    await vi.advanceTimersByTimeAsync(100)
    expect(synthesis.speak).toHaveBeenCalledTimes(3)
  })
})

// Vitest's node env has no real window; voice.ts checks `window` first.
// We simulate one so the module path under test runs its browser branches.
if (!realWindow) {
  ;(globalThis as Record<string, unknown>).window = globalThis
}
