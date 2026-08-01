import { AnimatePresence, motion } from 'framer-motion'
import { useState, type ReactNode } from 'react'
import { HiOutlineChevronDown } from 'react-icons/hi2'
import { cn } from '@/utils/cn'

export function Accordion({
  items,
  className,
  defaultOpen,
}: {
  items: Array<{ id: string; title: ReactNode; content: ReactNode }>
  className?: string
  defaultOpen?: string
}) {
  const [open, setOpen] = useState<string | null>(defaultOpen ?? null)
  return (
    <div className={cn('space-y-2', className)}>
      {items.map((item) => {
        const isOpen = open === item.id
        return (
          <div
            key={item.id}
            className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.03]"
          >
            <button
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : item.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span className="text-[13px] font-medium text-soft-white">{item.title}</span>
              <motion.span
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="text-muted"
              >
                <HiOutlineChevronDown className="size-4" />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="px-4 pb-4 text-sm leading-relaxed text-silver">
                    {item.content}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
