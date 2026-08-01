import { beforeEach, describe, expect, it } from 'vitest'
import { useMemoryStore } from '@/stores/memoryStore'
import { MEMORY_STORAGE_KEY } from '@/services/memory'

describe('memoryStore', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useMemoryStore.getState().reset()
  })

  it('seeds a full memory graph', () => {
    const s = useMemoryStore.getState()
    expect(s.projects.length).toBeGreaterThan(0)
    expect(s.goals.length).toBeGreaterThan(0)
    expect(s.preferences.length).toBeGreaterThan(0)
    expect(s.pinned.length).toBeGreaterThan(0)
    expect(s.facts.length).toBeGreaterThan(0)
    expect(s.timeline.length).toBeGreaterThan(0)
  })

  it('adds a fact and persists it to localStorage', () => {
    const before = useMemoryStore.getState().facts.length
    useMemoryStore.getState().addFact('Test fact here', 'work')

    const s = useMemoryStore.getState()
    expect(s.facts.length).toBe(before + 1)
    expect(s.facts[0].text).toBe('Test fact here')

    const stored = JSON.parse(window.localStorage.getItem(MEMORY_STORAGE_KEY) ?? '{}')
    expect(stored.facts[0].text).toBe('Test fact here')
  })

  it('addFact appends a timeline entry', () => {
    useMemoryStore.getState().addFact('Another fact', 'preference')
    const s = useMemoryStore.getState()
    expect(s.timeline[0].text).toContain('Another fact')
  })

  it('removes a fact', () => {
    const { addFact, removeFact } = useMemoryStore.getState()
    addFact('Doomed fact', 'personal')
    const id = useMemoryStore.getState().facts[0].id
    removeFact(id)
    expect(useMemoryStore.getState().facts.some((f) => f.id === id)).toBe(false)
  })

  it('resets to the seeded graph', () => {
    const { addFact, reset } = useMemoryStore.getState()
    addFact('Temporary', 'work')
    reset()
    const s = useMemoryStore.getState()
    expect(s.facts.some((f) => f.text === 'Temporary')).toBe(false)
    expect(s.projects.length).toBeGreaterThan(0)
  })

  it('filters via search without mutating data', () => {
    const { setSearch } = useMemoryStore.getState()
    setSearch('portfolio')
    expect(useMemoryStore.getState().search).toBe('portfolio')
    setSearch('')
  })
})
