import { create } from 'zustand'
import type { OrbMode, PresenceMode } from '@/types'

const MODE_INTENSITY: Record<OrbMode, number> = {
  idle: 0.2,
  monitoring: 0.35,
  listening: 0.55,
  thinking: 0.75,
  speaking: 0.92,
  processing: 0.7,
  completed: 0.45,
}

interface OrbState {
  mode: OrbMode
  presence: PresenceMode
  engagement: number
  setMode: (m: OrbMode) => void
  setPresence: (p: PresenceMode) => void
  poke: () => void
}

export const useOrbStore = create<OrbState>()((set) => ({
  mode: 'monitoring',
  presence: 'monitoring',
  engagement: 0.35,

  setMode: (mode) => set({ mode }),
  setPresence: (presence) => set({ presence }),
  poke: () => {
    set((s) => ({ engagement: Math.min(1, s.engagement + 0.6) }))
    window.setTimeout(
      () => set((s) => ({ engagement: Math.max(0, s.engagement - 0.6) })),
      600,
    )
  },
}))

export function intensityFor(mode: OrbMode): number {
  return MODE_INTENSITY[mode]
}
