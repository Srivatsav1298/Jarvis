import { create } from 'zustand'
import type { Notification, Toast } from '@/types'
import { api } from '@/services/api'
import { socket } from '@/services/ws'
import { NOTIFICATION_CREATED } from '@/services/events'

const SEVERITY_KIND: Record<string, Notification['kind']> = {
  accent: 'intelligence',
  ok: 'schedule',
  warn: 'reminder',
  success: 'system',
  danger: 'system',
  info: 'system',
}

const SEVERITY_TONE: Record<string, Toast['tone']> = {
  ok: 'success',
  warn: 'warning',
  danger: 'error',
  info: 'info',
  accent: 'info',
  success: 'success',
}

export interface ApiNotification {
  id: string
  type: string
  severity: string
  title: string
  message: string | null
  read: boolean
  created_at: string
}

export function toNotification(n: ApiNotification): Notification {
  return {
    id: n.id,
    title: n.title,
    body: n.message ?? n.title,
    time: new Date(n.created_at).getTime(),
    read: n.read,
    kind: SEVERITY_KIND[n.severity] ?? 'system',
  }
}

interface NotificationState {
  notifications: Notification[]
  unread: number
  hydrated: boolean
  live: boolean
  load: () => Promise<void>
  markRead: (id: string, read?: boolean) => Promise<void>
  markAllRead: () => Promise<void>
  start: (pushToast?: (t: Omit<Toast, 'id' | 'createdAt'>) => void) => void
  stop: () => void
}

export const useNotificationStore = create<NotificationState>()((set, get) => {
  let unsubscribe: (() => void) | null = null

  const localSet = (list: Notification[]) =>
    set({
      notifications: list,
      unread: list.filter((n) => !n.read).length,
    })

  return {
    notifications: [],
    unread: 0,
    hydrated: false,
    live: false,

    load: async () => {
      try {
        const data = await api.get<{ items: ApiNotification[] }>('/notifications')
        localSet((data.items ?? []).map(toNotification))
      } catch {
        // surface nothing when the API is unreachable — notification list stays empty
      } finally {
        set({ hydrated: true })
      }
    },

    markRead: async (id, read = true) => {
      localSet(
        get().notifications.map((n) => (n.id === id ? { ...n, read } : n)),
      )
      try {
        await api.patch(`/notifications/${id}/read?read=${read}`)
      } catch {
        // local read state already applied
      }
    },

    markAllRead: async () => {
      localSet(get().notifications.map((n) => ({ ...n, read: true })))
      await Promise.all(
        get().notifications
          .filter((n) => !n.read)
          .map((n) => api.patch(`/notifications/${n.id}/read?read=true`)),
      )
    },

    start: (pushToast) => {
      unsubscribe?.()
      unsubscribe = socket.subscribe(NOTIFICATION_CREATED, (payload) => {
        const apiN = payload as unknown as ApiNotification
        if (!apiN || !apiN.id) return
        const note = toNotification(apiN)
        set({
          notifications: [note, ...get().notifications],
          unread: get().unread + (note.read ? 0 : 1),
        })
        if (pushToast && !note.read) {
          pushToast({
            title: note.title,
            message: note.body,
            tone: SEVERITY_TONE[apiN.severity] ?? 'info',
          })
        }
      })
      set({ live: true })
    },

    stop: () => {
      unsubscribe?.()
      unsubscribe = null
      set({ live: false })
    },
  }
})