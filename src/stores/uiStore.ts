import { create } from 'zustand'
import { uid } from '@/utils/random'
import type { Toast, ViewId } from '@/types'

export interface Profile {
  name: string
  handle: string
  role: string
}

interface UIState {
  sidebarCollapsed: boolean
  memoryDockOpen: boolean
  commandPaletteOpen: boolean
  notificationsOpen: boolean
  toasts: Toast[]
  soundEnabled: boolean
  reducedMotion: boolean
  systemReducedMotion: boolean
  activeView: ViewId
  profile: Profile

  setSidebarCollapsed: (v: boolean) => void
  toggleSidebar: () => void
  setMemoryDockOpen: (v: boolean) => void
  toggleMemoryDock: () => void
  setCommandPaletteOpen: (v: boolean) => void
  setNotificationsOpen: (v: boolean) => void
  setActiveView: (v: ViewId) => void
  setSoundEnabled: (v: boolean) => void
  setReducedMotion: (v: boolean) => void
  pushToast: (t: Omit<Toast, 'id' | 'createdAt'>) => void
  dismissToast: (id: string) => void
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarCollapsed: false,
  memoryDockOpen: true,
  commandPaletteOpen: false,
  notificationsOpen: false,
  toasts: [],
  soundEnabled: true,
  reducedMotion: false,
  systemReducedMotion: false,
  activeView: 'overview',
  profile: {
    name: 'Sir',
    handle: '@sir',
    role: 'Principal Engineer',
  },

  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setMemoryDockOpen: (v) => set({ memoryDockOpen: v }),
  toggleMemoryDock: () => set((s) => ({ memoryDockOpen: !s.memoryDockOpen })),
  setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),
  setNotificationsOpen: (v) => set({ notificationsOpen: v }),
  setActiveView: (v) => set({ activeView: v }),
  setSoundEnabled: (v) => set({ soundEnabled: v }),
  setReducedMotion: (v) => set({ reducedMotion: v }),
  pushToast: (t) =>
    set((s) => ({
      toasts: [...s.toasts.slice(-3), { ...t, id: uid('toast'), createdAt: Date.now() }],
    })),
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
