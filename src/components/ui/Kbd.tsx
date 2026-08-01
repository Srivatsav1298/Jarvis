import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/utils/cn'

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-6 items-center justify-center rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] font-medium text-silver">
      {children}
    </kbd>
  )
}

type Placement = 'top' | 'bottom' | 'left' | 'right'

export function Tooltip({
  label,
  children,
  side = 'top',
  className,
}: {
  label: ReactNode
  children: ReactNode
  side?: Placement
  className?: string
}) {
  const [open, setOpen] = useState(false)

  const pos: Record<Placement, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 2 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 2 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              'pointer-events-none absolute z-50 whitespace-nowrap rounded-lg border border-white/10 bg-graphite/95 px-2.5 py-1.5 text-xs font-medium text-soft-white shadow-pop backdrop-blur-xl',
              pos[side],
              className,
            )}
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
