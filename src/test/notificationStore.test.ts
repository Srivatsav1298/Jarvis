import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotificationStore } from '@/stores/notificationStore'
import { api } from '@/services/api'

const handlers = new Map<string, (payload: Record<string, unknown>) => void>()
const unsubs = new Map<string, () => void>()

vi.mock('@/services/ws', () => ({
  socket: {
    subscribe: (type: string, cb: (p: Record<string, unknown>) => void) => {
      handlers.set(type, cb)
      const unsub = () => {
        handlers.delete(type)
        unsubs.delete(type)
      }
      unsubs.set(type, unsub)
      return unsub
    },
    sendRaw: vi.fn(),
  },
}))

vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      get: vi.fn(),
      patch: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      del: vi.fn(),
    },
  }
})

const mountedGet = api.get as ReturnType<typeof vi.fn>
const mountedPatch = api.patch as ReturnType<typeof vi.fn>

const sample = [
  {
    id: 'n1',
    type: 'job',
    severity: 'accent',
    title: 'New top-match role',
    message: 'Nova Systems — Staff Platform Engineer',
    read: false,
    created_at: '2026-08-04T09:00:00Z',
  },
  {
    id: 'n2',
    type: 'system',
    severity: 'info',
    title: 'System nominal',
    message: 'All health checks passing.',
    read: true,
    created_at: '2026-08-04T08:00:00Z',
  },
]

beforeEach(() => {
  handlers.clear()
  unsubs.clear()
  vi.clearAllMocks()
  useNotificationStore.setState({ notifications: [], unread: 0, hydrated: false, live: false })
})

afterEach(() => {
  unsubs.forEach((u) => u())
  vi.restoreAllMocks()
})

describe('notificationStore', () => {
  it('loads notifications and computes unread count', async () => {
    mountedGet.mockResolvedValue({ items: sample })
    await useNotificationStore.getState().load()
    const s = useNotificationStore.getState()
    expect(s.notifications).toHaveLength(2)
    expect(s.unread).toBe(1)
    expect(s.notifications[0]).toMatchObject({ title: 'New top-match role', kind: 'intelligence' })
    expect(s.hydrated).toBe(true)
  })

  it('marks a notification read via PATCH and updates unread', async () => {
    mountedGet.mockResolvedValue({ items: sample })
    await useNotificationStore.getState().load()
    mountedPatch.mockResolvedValue({})
    await useNotificationStore.getState().markRead('n1')
    expect(mountedPatch).toHaveBeenCalledWith('/notifications/n1/read?read=true')
    expect(useNotificationStore.getState().unread).toBe(0)
  })

  it('marks all read', async () => {
    mountedGet.mockResolvedValue({ items: sample })
    await useNotificationStore.getState().load()
    await useNotificationStore.getState().markAllRead()
    expect(useNotificationStore.getState().unread).toBe(0)
    expect(useNotificationStore.getState().notifications.every((n) => n.read)).toBe(true)
  })

  it('appends live notifications from WS and maps severity to toast', async () => {
    const pushToast = vi.fn()
    useNotificationStore.getState().start(pushToast)

    handlers.get('notification.created')?.({
      id: 'n9',
      type: 'reminder',
      severity: 'warn',
      title: 'Deadline today',
      message: 'Vector Search design doc — 17:00',
      read: false,
      created_at: '2026-08-04T10:00:00Z',
    })

    const s = useNotificationStore.getState()
    expect(s.unread).toBe(1)
    expect(s.notifications[0].title).toBe('Deadline today')
    expect(pushToast).toHaveBeenCalledWith({
      title: 'Deadline today',
      message: 'Vector Search design doc — 17:00',
      tone: 'warning',
    })
  })

  it('stops unsubscribing from live notifications', () => {
    useNotificationStore.getState().start()
    expect(useNotificationStore.getState().live).toBe(true)
    useNotificationStore.getState().stop()
    expect(useNotificationStore.getState().live).toBe(false)
    expect(handlers.has('notification.created')).toBe(false)
  })
})