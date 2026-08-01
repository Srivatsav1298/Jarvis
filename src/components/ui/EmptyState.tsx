import { motion } from 'framer-motion'
import { HiOutlineFolderOpen, HiOutlineExclamationTriangle } from 'react-icons/hi2'

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`flex flex-col items-center justify-center gap-2 py-14 text-center ${className ?? ''}`}
    >
      <span className="grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-muted [&>svg]:size-6">
        {icon ?? <HiOutlineFolderOpen />}
      </span>
      <p className="mt-1 text-sm font-medium text-soft-white">{title}</p>
      {description && <p className="max-w-sm text-xs leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </motion.div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'The panel could not be loaded. Try again in a moment.',
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-2 py-14 text-center"
    >
      <span className="grid size-12 place-items-center rounded-2xl border border-danger/20 bg-danger/10 text-danger [&>svg]:size-6">
        <HiOutlineExclamationTriangle />
      </span>
      <p className="mt-1 text-sm font-medium text-soft-white">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-muted">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-[10px] border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-medium text-soft-white transition-colors hover:bg-white/10"
        >
          Try again
        </button>
      )}
    </div>
  )
}
