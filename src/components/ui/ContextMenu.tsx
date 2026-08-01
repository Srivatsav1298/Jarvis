import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import { audioService } from '@/services/audio'
import type { MenuItem } from './Menu'

export function ContextMenu({
  items,
  children,
  className,
  label,
}: {
  items: MenuItem[]
  children: ReactNode
  className?: string
  label?: string
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLDivElement | null>(null)

  const close = useCallback(() => setPos(null), [])

  useEffect(() => {
    if (!pos) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [pos, close])

  return (
    <div
      ref={ref}
      className={cn('relative', className)}
      onContextMenu={(e) => {
        e.preventDefault()
        const rect = ref.current?.getBoundingClientRect()
        const menuW = 200
        const x = Math.min(e.clientX, (rect?.right ?? window.innerWidth) - menuW)
        const y = Math.min(e.clientY, window.innerHeight - 220)
        setPos({ x, y })
      }}
    >
      {children}
      <AnimatePresence>
        {pos && (
          <motion.div
            role="menu"
            aria-label={label}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.14 }}
            style={{ left: pos.x, top: pos.y }}
            className="fixed z-[70] w-[210px] rounded-xl border border-white/10 bg-graphite/95 p-1 shadow-pop backdrop-blur-xl"
          >
            {items.map((item) => (
              <button
                key={item.id}
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  audioService.play('click')
                  item.onSelect?.()
                  close()
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors',
                  item.disabled
                    ? 'opacity-40'
                    : item.danger
                      ? 'text-danger hover:bg-danger/10'
                      : 'text-silver hover:bg-white/[0.06] hover:text-soft-white',
                )}
              >
                {item.icon && <span className="text-base">{item.icon}</span>}
                <span className="flex-1">{item.label}</span>
                {item.hint && (
                  <span className="font-mono text-[10px] text-muted">{item.hint}</span>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
