import { create } from 'zustand'
import type {
  Fact,
  MemoryProject,
  MemoryState,
  MemoryTimelineItem,
} from '@/types'
import { api } from '@/services/api'
import { seedMemory } from '@/services/memory'
import { uid } from '@/utils/random'

interface ApiProject {
  id: string
  name: string
  description: string | null
  status: 'active' | 'paused' | 'archived'
  color: string
  created_at: string
  updated_at: string
}

interface ApiMemoryEntry {
  id: string
  kind: string
  content: string
  importance: number
  created_at: string
  updated_at: string
}

const KIND_CATEGORY: Record<string, Fact['category']> = {
  personal: 'personal',
  work: 'work',
  career: 'career',
  preference: 'preference',
}

const PROJECT_STATUS: Record<string, MemoryProject['status']> = {
  active: 'active',
  paused: 'paused',
  archived: 'completed',
}

function toProject(p: ApiProject): MemoryProject {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? '',
    status: PROJECT_STATUS[p.status] ?? 'active',
    progress: 0,
    updatedAt: new Date(p.updated_at).toISOString(),
  }
}

function toFact(e: ApiMemoryEntry): Fact {
  return {
    id: e.id,
    text: e.content,
    category: KIND_CATEGORY[e.kind] ?? 'personal',
    at: new Date(e.created_at).toISOString(),
  }
}

interface MemoryStoreState extends MemoryState {
  search: string
  hydrated: boolean
  settings: Record<string, unknown>
  setSearch: (q: string) => void
  load: () => Promise<void>
  loadSettings: () => Promise<void>
  saveSettings: (patch: Record<string, unknown>) => Promise<void>
  addFact: (text: string, category: Fact['category']) => void
  removeFact: (id: string) => void
  updateProject: (id: string, patch: Partial<MemoryProject>) => void
  pushTimeline: (item: Omit<MemoryTimelineItem, 'id'>) => void
  reset: () => void
}

const seeded = seedMemory()

export const useMemoryStore = create<MemoryStoreState>()((set, get) => ({
  ...seeded,
  search: '',
  hydrated: false,
  settings: {},

  setSearch: (search) => set({ search }),

  load: async () => {
    try {
      const [projects, prefs, facts] = await Promise.all([
        api.get<{ items: ApiProject[] }>('/projects'),
        api.get<{ data: Record<string, unknown> }>('/preferences'),
        api.get<{ items: ApiMemoryEntry[] }>('/memory/entries'),
      ])
      set({
        projects: (projects.items ?? []).map(toProject),
        preferences: Object.entries(prefs.data ?? {}).map(([key, value]) => ({
          id: key,
          key,
          value: String(value),
        })),
        facts: (facts.items ?? []).map(toFact),
      })
    } catch {
      // keep seeded baseline when the API is unreachable
    } finally {
      set({ hydrated: true })
    }
  },

  loadSettings: async () => {
    try {
      const res = await api.get<{ data: Record<string, unknown> }>('/settings')
      set({ settings: res.data ?? {} })
    } catch {
      // settings remain empty when the API is unreachable
    }
  },

  saveSettings: async (patch) => {
    const merged = { ...get().settings, ...patch }
    set({ settings: merged })
    try {
      const res = await api.patch<{ data: Record<string, unknown> }>('/settings', {
        data: patch,
      })
      set({ settings: res.data ?? merged })
    } catch {
      // local merge already applied
    }
  },

  addFact: (text, category) => {
    const fact: Fact = { id: uid('f'), text, category, at: 'Just now' }
    set({ facts: [fact, ...get().facts] })
    get().pushTimeline({
      at: 'Just now',
      text: `Recorded fact: ${text.slice(0, 48)}`,
      kind: 'learning',
    })
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

  reset: () => set({ ...seedMemory(), settings: {}, hydrated: false }),
}))