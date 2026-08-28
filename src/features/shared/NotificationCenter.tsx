import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useUIStore } from '@/stores/uiStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { relativeTime } from '@/utils/format'
import { Icon } from '@/components/ui'
import { cn } from '@/utils/cn'

const KIND_ICON: Record<string, string> = {
  intelligence: 'newspaper',
  career: 'briefcase',
  schedule: 'calendar',
  system: 'server',
  reminder: 'clock',
}

export function NotificationCenter() {
  const open = useUIStore((s) => s.notificationsOpen)
  const setOpen = useUIStore((s) => s.setNotificationsOpen)
  const pushToast = useUIStore((s) => s.pushToast)

  const notifications = useNotificationStore((s) => s.notifications)
  const unread = useNotificationStore((s) => s.unread)
  const load = useNotificationStore((s) => s.load)
  const markRead = useNotificationStore((s) => s.markRead)
  const markAllRead = useNotificationStore((s) => s.markAllRead)
  const start = useNotificationStore((s) => s.start)

  useEffect(() => {
    void load()
    start(pushToast)
    return () => useNotificationStore.getState().stop()
  }, [load, start, pushToast])

  return (
    <div className="relative">
      <button
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        onClick={() => setOpen(!open)}
        className="relative grid size-9 place-items-center rounded-[10px] text-silver transition-colors hover:bg-white/[0.06] hover:text-soft-white"
      >
        <span className="text-lg leading-none">
          <Icon name="bell" className="size-[18px]" />
        </span>
        {unread > 0 && (
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-accent shadow-glow-cyan" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="glass-raised absolute right-0 top-12 z-50 w-[340px] overflow-hidden rounded-2xl shadow-pop"
            role="dialog"
            aria-label="Notifications"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <div>
                <p className="text-[13px] font-semibold text-soft-white">Notifications</p>
                <p className="text-[10px] text-muted">
                  {unread > 0 ? `${unread} unread` : 'All caught up'}
                </p>
              </div>
              <button
                onClick={() => void markAllRead()}
                className="rounded-lg px-2 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/10"
              >
                Mark all read
              </button>
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {notifications.length === 0 && (
                <p className="px-4 py-6 text-center text-xs text-muted">
                  No notifications yet.
                </p>
              )}
              {notifications.map((n) => {
                const isRead = n.read
                return (
                  <button
                    key={n.id}
                    onClick={() => void markRead(n.id, !isRead)}
                    className={cn(
                      'flex w-full items-start gap-3 border-b border-white/[0.04] px-4 py-3 text-left transition-colors hover:bg-white/[0.03]',
                      !isRead && 'bg-accent/[0.04]',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 text-silver',
                        !isRead && 'border-accent/20 text-accent',
                      )}
                    >
                      <Icon name={KIND_ICON[n.kind]} className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-soft-white">
                        {n.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                        {n.body}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-muted">
                      {relativeTime(n.time)}
                    </span>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}