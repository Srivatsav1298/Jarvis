/** Real speech recognition + British text-to-speech via browser APIs.
 *
 * STT uses the Web Speech API (SpeechRecognition) when the browser supports
 * it; TTS uses speechSynthesis with a preference for en-GB voices so Starc
 * answers in a British accent. Both degrade gracefully when unsupported.
 */

export interface VoiceSession {
  start: (onResult: (text: string) => void, onEnd: () => void, onError?: (message: string) => void) => void
  stop: () => void
}

const BRITISH_LOCALES = ['en-gb', 'en_gb', 'en-uk', 'en_uk']

/** Premium British voices, best first across macOS, Windows, iOS, Chrome, Edge, Safari. */
const PREFERRED_BRITISH = [
  'daniel',
  'george',
  'google uk english male',
  'google uk english female',
  'microsoft george online (natural) - english (united kingdom)',
  'microsoft hazel - english (great britain)',
  'microsoft susan - english (great britain)',
  'microsoft george',
  'microsoft abbi online (natural)',
  'arthur',
  'oliver',
  'kate',
  'libby',
  'serena',
  'sonia',
  'harriet',
  'martha',
  'albert',
  'ryan',
  'fiona',
]

/** Strip markdown tags, special characters, and deduplicate repeated words/phrases for speech output. */
export function cleanTextForSpeech(text: string): string {
  if (!text) return ''
  let cleaned = text
    // Remove markdown links [label](url) -> label
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove code blocks and inline code ticks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Remove header symbols (#, ##, etc.) at start or mid-string
    .replace(/(?:^|\s)#{1,6}\s+/g, ' ')
    // Remove bold/italic markup (**text**, *text*, __text__, _text_)
    .replace(/(\*\*|__|\*|_)(.*?)\1/g, '$2')
    // Remove bullet points / blockquotes
    .replace(/^[\s*>-]+/gm, '')
    // Replace remaining HTML tags if any
    .replace(/<[^>]*>/g, '')
    // Normalize punctuation quotes
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim()

  // Deduplicate repeated adjacent phrases (e.g. "what time is it what time is it" -> "what time is it")
  cleaned = deduplicatePhrases(cleaned)

  // Deduplicate consecutive repeated single words, handling optional punctuation between them
  // (case-insensitive, e.g. "is is" -> "is", "first? first." -> "first.")
  cleaned = cleaned.replace(/\b(\w+)(?:[^\w\s]*\s+\1\b)+/gi, '$1')

  // Clean up extra spaces
  return cleaned.replace(/\s+/g, ' ').trim()
}

/** Helper to remove adjacent identical multi-word phrases (2+ words). */
function deduplicatePhrases(input: string): string {
  const words = input.split(/\s+/)
  if (words.length < 4) return input

  for (let phraseLen = Math.floor(words.length / 2); phraseLen >= 2; phraseLen -= 1) {
    for (let i = 0; i <= words.length - phraseLen * 2; i += 1) {
      const phrase1 = words.slice(i, i + phraseLen).join(' ').toLowerCase().replace(/[^\w\s]/g, '')
      const phrase2 = words.slice(i + phraseLen, i + phraseLen * 2).join(' ').toLowerCase().replace(/[^\w\s]/g, '')

      if (phrase1 && phrase1 === phrase2) {
        words.splice(i + phraseLen, phraseLen)
        return deduplicatePhrases(words.join(' '))
      }
    }
  }
  return words.join(' ')
}

/** Optional overrides for speak() — mirror the Voice Settings panel. */
export interface SpeakOptions {
  rate?: number
  pitch?: number
  volume?: number
  /** Exact SpeechSynthesisVoice.name to force; ''/undefined = auto British ranking. */
  voiceName?: string
  /** Fired when the first utterance actually starts playing. */
  onstart?: () => void
  onend?: () => void
  /** Fired for a real synthesis error (cancellation is ignored). */
  onerror?: (message: string) => void
}

/** Read-only voice descriptor surfaced to the settings panel. */
export interface VoiceDescriptor {
  name: string
  lang: string
  localService: boolean
  default: boolean
}

let cachedVoice: SpeechSynthesisVoice | null = null
let voiceListHash = ''

function resetVoiceCache(): void {
  cachedVoice = null
  voiceListHash = ''
}

/** Chrome/Safari load speech voices asynchronously; warm them up on module load. */
function warmupVoices(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.getVoices()
  window.speechSynthesis.onvoiceschanged = () => {
    resetVoiceCache()
    window.speechSynthesis.getVoices()
  }
}
warmupVoices()

export function pickBritishVoice(preferredName = ''): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null

  // Explicit user choice wins over automatic ranking.
  if (preferredName) {
    const exact = voices.find((v) => v.name === preferredName)
    if (exact) return exact
  }

  // Fast path: cached auto-picked voice lookup.
  const currentHash = voices.map((v) => `${v.name}:${v.lang}`).join('|')
  if (cachedVoice && voiceListHash === currentHash && !preferredName) {
    return cachedVoice
  }

  const isBritishLang = (v: SpeechSynthesisVoice) => {
    const lang = v.lang.toLowerCase()
    return BRITISH_LOCALES.some((l) => lang.startsWith(l)) || v.name.toLowerCase().includes('british') || v.name.toLowerCase().includes('uk english')
  }

  // Never silently pick a non-English voice when any English one exists
  // (spec §18 fallback ladder: en-GB -> other en -> best of the rest).
  const isEnglish = (v: SpeechSynthesisVoice) => {
    const lang = v.lang.toLowerCase()
    return lang.startsWith('en') || v.name.toLowerCase().includes('english')
  }

  const score = (v: SpeechSynthesisVoice) => {
    const name = v.name.toLowerCase()
    const rank = PREFERRED_BRITISH.findIndex((pref) => name.includes(pref))
    return {
      preferred: rank >= 0 ? -rank : 100 + name.length,
      isBritish: isBritishLang(v) ? 0 : 1,
      isEnglish: isEnglish(v) ? 0 : 1,
      local: v.localService ? 0 : 1,
    }
  }

  const sorted = [...voices].sort((a, b) => {
    const sa = score(a)
    const sb = score(b)
    if (sa.isBritish !== sb.isBritish) return sa.isBritish - sb.isBritish
    if (sa.isEnglish !== sb.isEnglish) return sa.isEnglish - sb.isEnglish
    if (sa.local !== sb.local) return sa.local - sb.local
    return sa.preferred - sb.preferred
  })

  const best = sorted[0] ?? null
  if (best) {
    cachedVoice = best
    voiceListHash = currentHash
  }
  return best
}

/** All voices the browser exposes, for the Voice settings panel. */
export function listVoices(): VoiceDescriptor[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return []
  return window.speechSynthesis.getVoices().map((v) => ({
    name: v.name,
    lang: v.lang,
    localService: v.localService,
    default: v.default,
  }))
}

let voicesReady: Promise<void> | null = null

/** Resolve once speechSynthesis has a non-empty voice list (Chrome loads them async). */
function waitForVoices(): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.resolve()
  }
  if (window.speechSynthesis.getVoices().length > 0) {
    voicesReady = Promise.resolve()
    return voicesReady
  }
  if (!voicesReady) {
    voicesReady = new Promise((resolve) => {
      const synth = window.speechSynthesis
      const done = () => {
        synth.onvoiceschanged = null
        resetVoiceCache()
        resolve()
      }
      const onVoices = () => {
        if (synth.getVoices().length > 0) done()
      }
      synth.onvoiceschanged = onVoices
      window.setTimeout(done, 1500)
    })
  }
  return voicesReady
}

let lastSpoken = ''
let pendingText: string | null = null

/** Sentence-segment a reply into natural speech chunks (spec §11). */
export function chunkSpeech(text: string): string[] {
  const clean = cleanTextForSpeech(text)
  if (!clean) return []
  const sentences =
    clean.match(/[^.!?…]+[.!?…]+["')\]]*|[^.!?…]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? []

  const chunks: string[] = []
  let current = ''
  let sentenceCount = 0
  for (const sentence of sentences) {
    if (current && (sentenceCount >= 3 || current.length + sentence.length > 220)) {
      chunks.push(current)
      current = sentence
      sentenceCount = 1
    } else {
      current = current ? `${current} ${sentence}` : sentence
      sentenceCount += 1
    }
  }
  if (current) chunks.push(current)
  if (chunks.length === 0 && clean) chunks.push(clean)
  return chunks
}

let speechQueue: SpeechSynthesisUtterance[] = []
let queueToken = 0

function speakNext(synth: SpeechSynthesis, opts: SpeakOptions, token: number, isFirst: boolean): void {
  if (queueToken !== token) return
  const utterance = speechQueue[0]
  if (!utterance) {
    pendingText = null
    opts.onend?.()
    return
  }

  utterance.onstart = () => {
    pendingText = null
    // Only the first chunk reports start — callers use it to (re)arm UI,
    // and firing it per-chunk would re-arm per utterance.
    if (isFirst) opts.onstart?.()
  }
  const advance = () => {
    if (queueToken !== token) return
    speechQueue.shift()
    if (speechQueue.length === 0) {
      pendingText = null
      lastSpoken = ''
      opts.onend?.()
    } else {
      // Small gap between chunks keeps Chrome's utterance boundary clean.
      window.setTimeout(() => speakNext(synth, opts, token, false), 40)
    }
  }
  utterance.onend = advance
  utterance.onerror = (event) => {
    if (queueToken === token) {
      const error = (event as SpeechSynthesisErrorEvent).error
      if (error && error !== 'canceled' && error !== 'interrupted') {
        opts.onerror?.(`Speech synthesis failed: ${error}`)
      }
    }
    advance()
  }

  // Defer the actual speak() so a same-tick cancel+speak settles first
  // (Chrome drops/glitches it). Speaking already stops the previous chunk.
  window.setTimeout(() => {
    if (queueToken !== token) return
    if (synth.speaking || synth.paused || synth.pending) {
      synth.cancel()
    }
    window.setTimeout(() => {
      if (queueToken !== token) return
      if (synth.paused) synth.resume()
      synth.speak(utterance)
    }, 30)
  }, 15)
}

/** Speak text aloud using a British (en-GB) voice when available. */
export function speak(
  text: string,
  { onend, onstart, onerror, rate = 1.0, pitch = 1.0, volume = 1.0, voiceName = '' }: SpeakOptions = {},
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false
  const clean = cleanTextForSpeech(text)
  if (!clean) return false
  const synth = window.speechSynthesis

  // Speak identical text at most once while it is pending or in flight —
  // a duplicate reply must never queue a second utterance (repeats bug).
  if (
    clean === pendingText ||
    (clean === lastSpoken && (synth.speaking || synth.pending))
  ) {
    return true
  }
  pendingText = clean
  lastSpoken = clean

  const voice = pickBritishVoice(voiceName)
  const chunks = chunkSpeech(clean)

  // Build the queue up-front with voice + prosody already applied.
  const queue = chunks.map((chunk) => {
    const utterance = new SpeechSynthesisUtterance(chunk)
    if (voice) utterance.voice = voice
    utterance.lang = voice?.lang ?? 'en-GB'
    // Keep the default rate exactly 1.0 — Chromium repeats/stutters words at
    // non-1.0 rates on macOS. British accent comes from the en-GB voice.
    utterance.rate = rate
    utterance.pitch = pitch
    utterance.volume = volume
    return utterance
  })
  speechQueue = queue

  queueToken += 1
  const token = queueToken
  void waitForVoices().then(() => {
    if (queueToken !== token) return
    speakNext(synth, { onend, onstart, onerror }, token, true)
  })
  return true
}

export function stopSpeaking(): void {
  queueToken += 1
  speechQueue = []
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
  lastSpoken = ''
  pendingText = null
  resetVoiceCache()
}

export function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionLike)
    | null
}

export function isSpeechSupported(): boolean {
  return isSpeechRecognitionSupported() && isSpeechSynthesisSupported()
}

export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' && getRecognitionCtor() !== null
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** Minimal structural typing for SpeechRecognition (partial TS lib coverage). */
export interface SpeechRecognitionResultLike {
  readonly length: number
  readonly isFinal: boolean
  readonly [index: number]: { readonly transcript: string }
}

export interface SpeechRecognitionEventLike {
  readonly resultIndex: number
  readonly results: {
    readonly length: number
    readonly [index: number]: SpeechRecognitionResultLike
  }
}

export interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

export function createVoiceSession(lang = 'en-GB', continuous = false): VoiceSession | null {
  const Ctor = getRecognitionCtor()
  if (!Ctor) return null
  const recognition = new Ctor()
  recognition.lang = lang
  recognition.continuous = continuous
  recognition.interimResults = true
  recognition.maxAlternatives = 1
  let final = ''
  let lastEmitted = ''
  let onResultCb: ((text: string) => void) | null = null
  let onEndCb: (() => void) | null = null
  let onErrorCb: ((message: string) => void) | null = null
  let ended = false

  // Dedupe identical CONSECUTIVE final segments and collapse stray single/multi-word repeats.
  const normalizeSegments = (segments: string[]) => {
    const deduped: string[] = []
    for (const seg of segments) {
      if (deduped.length > 0 && deduped[deduped.length - 1] === seg) continue
      deduped.push(seg)
    }
    const joined = deduped.join(' ').replace(/\s+/g, ' ').trim()
    return cleanTextForSpeech(joined)
  }

  recognition.onresult = (event) => {
    if (ended) return
    // Idempotent recompute: rebuild `final` from every finalized segment each
    // event. Chrome persists results and re-fires them, so incremental
    // append double-counts. Rebuilding yields the same string every time.
    const finals: string[] = []
    for (let i = 0; i < event.results.length; i += 1) {
      const result = event.results[i]
      if (result.isFinal) {
        const transcript = result[0]?.transcript ?? ''
        if (transcript) finals.push(transcript.trim())
      }
    }
    const rebuilt = normalizeSegments(finals)
    if (rebuilt !== final) {
      final = rebuilt
    }

    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i]
      if (!result.isFinal) {
        interim = result[0]?.transcript ?? ''
      }
    }
    const current = final || cleanTextForSpeech(interim)
    if (current && current !== lastEmitted && onResultCb) {
      lastEmitted = current
      onResultCb(current)
    }
  }

  recognition.onerror = (event) => {
    if (ended) return
    if (event.error !== 'aborted' && event.error !== 'no-speech') {
      onErrorCb?.(
        event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'Microphone permission was denied. Allow microphone access and try again.'
          : `Speech recognition failed: ${event.error}`,
      )
      ended = true
      onEndCb?.()
    }
  }

  recognition.onend = () => {
    if (ended) return
    ended = true
    if (final && onResultCb) onResultCb(final)
    onEndCb?.()
  }

  return {
    start(onResult, onEnd, onError) {
      final = ''
      lastEmitted = ''
      ended = false
      onResultCb = onResult
      onEndCb = onEnd
      onErrorCb = onError ?? null
      try {
        recognition.start()
      } catch (error) {
        if (!ended) {
          onErrorCb?.(
            error instanceof Error && error.message
              ? `Could not start speech recognition: ${error.message}`
              : 'Could not start speech recognition. Check microphone permissions and try again.',
          )
          ended = true
          onEndCb?.()
        }
      }
    },
    stop() {
      try {
        recognition.stop()
      } catch {
        if (!ended) {
          ended = true
          onEndCb?.()
        }
      }
    },
  }
}
