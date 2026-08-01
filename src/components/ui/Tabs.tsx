import { useId, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'

export interface TabItem {
  id: string
  label: ReactNode
  icon?: ReactNode
}

export function Tabs({
  items,
  active,
  onChange,
  className,
}: {
  items: TabItem[]
  active: string
  onChange: (id: string) => void
  className?: string
}) {
  const layoutId = useId()
  return (
    <div
      role="tablist"
      className={cn('no-scrollbar flex items-center gap-1 overflow-x-auto', className)}
    >
      {items.map((item) => {
        const selected = item.id === active
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.id)}
            className={cn(
              'relative flex items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 py-1.5 text-[13px] font-medium transition-colors',
              selected ? 'text-soft-white' : 'text-muted hover:text-silver',
            )}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-[10px] border border-white/10 bg-white/[0.07]"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {item.icon}
              {item.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
