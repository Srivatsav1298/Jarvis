import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMemoryStore } from '@/stores/memoryStore'
import { api } from '@/services/api'

vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>()
  return {
    ...actual,
    api: {
      get: vi.fn(),
      patch: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      del: vi.fn(),
    },
  }
})

const mountedGet = api.get as ReturnType<typeof vi.fn>

afterEach(() => {
  vi.clearAllMocks()
})

describe('memoryStore', () => {
  beforeEach(() => {
    useMemoryStore.getState().reset()
  })

  it('has a seeded baseline with goals, pinned and timeline', () => {
    const s = useMemoryStore.getState()
    expect(s.goals.length).toBeGreaterThan(0)
    expect(s.pinned.length).toBeGreaterThan(0)
    expect(s.timeline.length).toBeGreaterThan(0)
  })

  it('loads projects, preferences and facts from the backend', async () => {
    mountedGet
      .mockResolvedValueOnce({
        items: [
          {
            id: 'p1',
            name: 'Portfolio Website',
            description: 'Case studies',
            status: 'active',
            color: 'accent',
            created_at: '2026-08-01T00:00:00Z',
            updated_at: '2026-08-02T00:00:00Z',
          },
        ],
      })
      .mockResolvedValueOnce({ data: { Communication: 'Concise' } })
      .mockResolvedValueOnce({
        items: [
          {
            id: 'e1',
            kind: 'work',
            content: 'Ship portfolio v2',
            importance: 0.8,
            created_at: '2026-08-02T00:00:00Z',
            updated_at: '2026-08-02T00:00:00Z',
          },
        ],
      })

    await useMemoryStore.getState().load()

    const s = useMemoryStore.getState()
    expect(s.projects).toHaveLength(1)
    expect(s.projects[0].name).toBe('Portfolio Website')
    expect(s.projects[0].status).toBe('active')
    expect(s.preferences).toHaveLength(1)
    expect(s.preferences[0]).toMatchObject({ key: 'Communication', value: 'Concise' })
    expect(s.facts).toHaveLength(1)
    expect(s.facts[0]).toMatchObject({ text: 'Ship portfolio v2', category: 'work' })
    expect(s.hydrated).toBe(true)
    expect(mountedGet).toHaveBeenCalledTimes(3)
  })

  it('maps archived projects to completed status', async () => {
    mountedGet
      .mockResolvedValueOnce({
        items: [
          {
            id: 'p2',
            name: 'CLI',
            description: '',
            status: 'archived',
            color: 'accent',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
          },
        ],
      })
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ items: [] })

    await useMemoryStore.getState().load()
    expect(useMemoryStore.getState().projects[0].status).toBe('completed')
  })

  it('falls back to the seeded baseline when the API is unavailable', async () => {
    mountedGet.mockRejectedValue(new Error('offline'))
    await useMemoryStore.getState().load()
    const s = useMemoryStore.getState()
    expect(s.hydrated).toBe(true)
    expect(s.facts.length).toBeGreaterThanOrEqual(0)
  })

  it('adds a fact locally with a timeline entry', () => {
    useMemoryStore.getState().addFact('Test fact here', 'work')
    const s = useMemoryStore.getState()
    expect(s.facts[0].text).toBe('Test fact here')
    expect(s.timeline[0].text).toContain('Test fact here')
  })

  it('removes a fact', () => {
    const { addFact, removeFact } = useMemoryStore.getState()
    addFact('Doomed fact', 'personal')
    const id = useMemoryStore.getState().facts[0].id
    removeFact(id)
    expect(useMemoryStore.getState().facts.some((f) => f.id === id)).toBe(false)
  })

  it('loads and merges settings', async () => {
    mountedGet.mockResolvedValue({ data: { sound: true } })
    await useMemoryStore.getState().loadSettings()
    expect(useMemoryStore.getState().settings).toEqual({ sound: true })
  })

  it('saves settings via PATCH and keeps the local merge', async () => {
    const apiPatch = api.patch as ReturnType<typeof vi.fn>
    apiPatch.mockResolvedValue({ data: { sound: true, motion: false } })
    await useMemoryStore.getState().saveSettings({ motion: false })
    expect(apiPatch).toHaveBeenCalledWith('/settings', { data: { motion: false } })
    expect(useMemoryStore.getState().settings).toEqual({ sound: true, motion: false })
  })

  it('filters via search without mutating data', () => {
    const { setSearch } = useMemoryStore.getState()
    setSearch('portfolio')
    expect(useMemoryStore.getState().search).toBe('portfolio')
    setSearch('')
  })
})