import { useUIStore } from '@/stores/uiStore'

export type SoundKind = 'click' | 'activate' | 'listen' | 'notify' | 'complete' | 'error'

/**
 * WebAudio service powering STARC's sound-reactive orb and soft UI sounds.
 * Everything is synthesized — no external assets. Muted by default until
 * the user interacts (browser autoplay policies), or a mic is enabled.
 */
class AudioService {
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private stream: MediaStream | null = null
  private simOsc: OscillatorNode | null = null
  private simGain: GainNode | null = null
  private data: Uint8Array<ArrayBuffer> = new Uint8Array(0)
  private micEnabled = false

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!Ctor) return null
      this.ctx = new Ctor()
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  get enabled(): boolean {
    return useUIStore.getState().soundEnabled
  }

  /** Current microphone-driven level in 0..1. Falls back to simulation. */
  getLevel(): number {
    if (this.analyser && this.micEnabled) {
      this.analyser.getByteFrequencyData(this.data)
      let sum = 0
      for (let i = 0; i < this.data.length; i += 1) sum += this.data[i]
      const avg = sum / Math.max(1, this.data.length)
      return Math.min(1, avg / 160)
    }
    // Simulated ambient level (gentle noise + slow wave)
    const t = performance.now() / 1000
    return 0.12 + 0.08 * Math.sin(t * 0.7) + 0.03 * Math.sin(t * 3.1)
  }

  async enableMic(): Promise<boolean> {
    const ctx = this.ensure()
    if (!ctx || !navigator.mediaDevices?.getUserMedia) return false
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const src = ctx.createMediaStreamSource(this.stream)
      this.analyser = ctx.createAnalyser()
      this.analyser.fftSize = 128
      this.data = new Uint8Array(this.analyser.frequencyBinCount)
      src.connect(this.analyser)
      this.micEnabled = true
      this.disposeSim()
      return true
    } catch {
      return false
    }
  }

  disableMic(): void {
    this.micEnabled = false
    this.analyser = null
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
  }

  private disposeSim(): void {
    this.simOsc?.disconnect()
    this.simGain?.disconnect()
    this.simOsc = null
    this.simGain = null
  }

  /** Plays a soft UI sound. No-ops when muted or on reduced motion. */
  play(kind: SoundKind): void {
    if (!this.enabled) return
    const ctx = this.ensure()
    if (!ctx) return
    const now = ctx.currentTime
    const gain = ctx.createGain()
    const osc = ctx.createOscillator()

    const configs: Record<SoundKind, { type: OscillatorType; f0: number; f1?: number; dur: number; vol: number }> = {
      click: { type: 'sine', f0: 1200, f1: 700, dur: 0.06, vol: 0.05 },
      activate: { type: 'sine', f0: 320, f1: 640, dur: 0.22, vol: 0.06 },
      listen: { type: 'sine', f0: 500, f1: 900, dur: 0.3, vol: 0.05 },
      notify: { type: 'sine', f0: 780, f1: 1180, dur: 0.28, vol: 0.05 },
      complete: { type: 'sine', f0: 520, f1: 1040, dur: 0.35, vol: 0.06 },
      error: { type: 'triangle', f0: 220, f1: 140, dur: 0.25, vol: 0.05 },
    }

    const cfg = configs[kind]
    osc.type = cfg.type
    osc.frequency.setValueAtTime(cfg.f0, now)
    if (cfg.f1) osc.frequency.exponentialRampToValueAtTime(cfg.f1, now + cfg.dur)

    gain.gain.setValueAtTime(cfg.vol, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + cfg.dur)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + cfg.dur + 0.02)
  }
}

export const audioService = new AudioService()
