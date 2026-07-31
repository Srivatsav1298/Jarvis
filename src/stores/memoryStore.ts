import { create } from 'zustand'
import type {
  Fact,
  MemoryProject,
  MemoryState,
  MemoryTimelineItem,
} from '@/types'
import { readStored, writeStored } from '@/hooks/useLocalStorage'
import { MEMORY_STORAGE_KEY, seedMemory } from '@/services/memory'
import { uid } from '@/utils/random'

interface MemoryStoreState extends MemoryState {
  search: string
  hydrated: boolean
  setSearch: (q: string) => void
  addFact: (text: string, category: Fact['category']) => void
  removeFact: (id: string) => void
  updateProject: (id: string, patch: Partial<MemoryProject>) => void
  pushTimeline: (item: Omit<MemoryTimelineItem, 'id'>) => void
  reset: () => void
}

function load(): MemoryState {
  const stored = readStored<MemoryState | null>(MEMORY_STORAGE_KEY, null)
  if (stored && stored.projects && stored.timeline) return stored
  const seeded = seedMemory()
  writeStored(MEMORY_STORAGE_KEY, seeded)
  return seeded
}

export const useMemoryStore = create<MemoryStoreState>()((set, get) => ({
  ...load(),
  search: '',
  hydrated: true,

  setSearch: (search) => set({ search }),

  addFact: (text, category) => {
    const fact: Fact = { id: uid('f'), text, category, at: 'Just now' }
    set({ facts: [fact, ...get().facts] })
    get().pushTimeline({ at: 'Just now', text: `Recorded fact: ${text.slice(0, 48)}`, kind: 'learning' })
  },

  removeFact: (id) => set((s) => ({ facts: s.facts.filter((f) => f.id !== id) })),

  updateProject: (id, patch) =>
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),

  pushTimeline: (item) =>
    set((s) => ({
      timeline: [{ ...item, id: uid('t') }, ...s.timeline].slice(0, 40),
    })),

  reset: () => {
    const seeded = seedMemory()
    set(seeded)
    writeStored(MEMORY_STORAGE_KEY, seeded)
  },
}))

/** Persist memory whenever it changes. */
useMemoryStore.subscribe((state) => {
  const { search, hydrated, ...persist } = state as unknown as MemoryStoreState
  void search
  void hydrated
  writeStored(MEMORY_STORAGE_KEY, persist)
})
