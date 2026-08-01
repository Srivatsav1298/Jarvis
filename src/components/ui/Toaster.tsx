import { AnimatePresence, motion } from 'framer-motion'
import { HiOutlineCheckCircle, HiOutlineInformationCircle, HiOutlineExclamationTriangle, HiOutlineXMark } from 'react-icons/hi2'
import { useUIStore } from '@/stores/uiStore'
import type { Toast } from '@/types'
import { cn } from '@/utils/cn'

const icons = {
  info: <HiOutlineInformationCircle className="size-4 text-accent" />,
  success: <HiOutlineCheckCircle className="size-4 text-ok" />,
  warning: <HiOutlineExclamationTriangle className="size-4 text-warn" />,
  error: <HiOutlineExclamationTriangle className="size-4 text-danger" />,
}

export function Toaster() {
  const toasts = useUIStore((s) => s.toasts)
  const dismiss = useUIStore((s) => s.dismissToast)

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-16 right-4 z-[90] flex w-[320px] flex-col gap-2"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 24, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      className="glass-raised pointer-events-auto flex items-start gap-3 rounded-xl p-3.5"
    >
      <span className="mt-0.5 shrink-0">{icons[toast.tone]}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-soft-white">{toast.title}</p>
        {toast.message && (
          <p className="mt-0.5 text-xs leading-relaxed text-silver">{toast.message}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className={cn(
          'shrink-0 rounded-md p-1 text-muted transition-colors hover:bg-white/[0.06] hover:text-soft-white',
        )}
      >
        <HiOutlineXMark className="size-3.5" />
      </button>
    </motion.div>
  )
}
