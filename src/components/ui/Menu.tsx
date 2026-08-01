import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import { audioService } from '@/services/audio'

export interface MenuItem {
  id: string
  label: ReactNode
  icon?: ReactNode
  hint?: string
  danger?: boolean
  disabled?: boolean
  onSelect?: () => void
}

export function Menu({
  trigger,
  items,
  align = 'end',
  className,
  menuClassName,
}: {
  trigger: ReactNode
  items: MenuItem[]
  align?: 'start' | 'end'
  className?: string
  menuClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className={cn('relative inline-flex', className)}>
      <button
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          audioService.play('click')
          setOpen((o) => !o)
        }}
      >
        {trigger}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label={`Menu ${id}`}
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className={cn(
              'absolute z-40 mt-2 min-w-[200px] origin-top rounded-xl border border-white/10 bg-graphite/95 p-1 shadow-pop backdrop-blur-xl',
              align === 'end' ? 'right-0' : 'left-0',
              menuClassName,
            )}
          >
            {items.map((item) => (
              <button
                key={item.id}
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  audioService.play('click')
                  item.onSelect?.()
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors',
                  item.disabled
                    ? 'cursor-not-allowed opacity-40'
                    : item.danger
                      ? 'text-danger hover:bg-danger/10'
                      : 'text-silver hover:bg-white/[0.06] hover:text-soft-white',
                )}
              >
                {item.icon && <span className="text-base">{item.icon}</span>}
                <span className="flex-1">{item.label}</span>
                {item.hint && <span className="font-mono text-[10px] text-muted">{item.hint}</span>}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
