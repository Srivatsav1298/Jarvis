import { forwardRef, useEffect, useRef } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { cn } from '@/utils/cn'
import { HiOutlineMagnifyingGlass, HiOutlineXMark } from 'react-icons/hi2'

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onChange?: (value: string) => void
  onClear?: () => void
  iconClassName?: string
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, onChange, onClear, value, placeholder, iconClassName, ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement | null>(null)
    const mv = useMotionValue(0)
    const spring = useSpring(mv, { stiffness: 260, damping: 24 })

    useEffect(() => {
      if (ref) {
        if (typeof ref === 'function') ref(inputRef.current)
        else ref.current = inputRef.current
      }
    }, [ref])

    return (
      <div className={cn('group relative', className)}>
        <motion.div
          style={{ scaleX: spring }}
          className="pointer-events-none absolute inset-0 rounded-[10px] border border-accent/40 bg-white/[0.04] opacity-0 group-focus-within:opacity-100"
        />
        <HiOutlineMagnifyingGlass
          className={cn(
            'pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted transition-colors group-focus-within:text-accent',
            iconClassName,
          )}
        />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            mv.set(1)
            window.setTimeout(() => mv.set(0), 120)
            onChange?.(e.target.value)
          }}
          placeholder={placeholder ?? 'Search…'}
          className="h-10 w-full rounded-[10px] border border-white/10 bg-white/[0.04] pl-10 pr-9 text-sm text-soft-white placeholder:text-muted/70 transition-colors focus:outline-none"
          {...props}
        />
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              onClear?.()
              inputRef.current?.focus()
            }}
            className="absolute right-2.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted transition-colors hover:bg-white/[0.06] hover:text-soft-white"
          >
            <HiOutlineXMark className="size-3.5" />
          </button>
        ) : null}
      </div>
    )
  },
)
SearchInput.displayName = 'SearchInput'
