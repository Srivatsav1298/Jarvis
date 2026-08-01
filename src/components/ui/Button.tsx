import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/utils/cn'
import { audioService } from '@/services/audio'
import { Spinner } from './Skeleton'

type Variant = 'primary' | 'secondary' | 'ghost' | 'glass'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'ref' | 'children'> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  children?: ReactNode
}

const base =
  'inline-flex items-center justify-center gap-2 font-medium tracking-tight select-none transition-colors disabled:opacity-50 disabled:pointer-events-none'

const variants: Record<Variant, string> = {
  primary:
    'bg-soft-white text-graphite shadow-[0_1px_0_rgba(255,255,255,0.4)_inset] hover:bg-white/95',
  secondary:
    'bg-white/[0.06] text-soft-white border border-white/10 hover:bg-white/10',
  ghost: 'text-silver hover:text-soft-white hover:bg-white/[0.06]',
  glass: 'glass text-soft-white hover:border-white/15 hover:bg-white/[0.06]',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-[10px]',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-12 px-6 text-[15px] rounded-xl',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'secondary', size = 'md', loading, disabled, icon, children, className, onClick, ...props },
    ref,
  ) => {
    return (
      <motion.button
        ref={ref}
        disabled={loading || disabled}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className={cn(base, variants[variant], sizes[size], className)}
        onClick={(e) => {
          audioService.play('click')
          onClick?.(e)
        }}
        {...props}
      >
        {loading ? <Spinner className="size-4" /> : icon}
        {children}
      </motion.button>
    )
  },
)
Button.displayName = 'Button'

export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  children: ReactNode
}) {
  return (
    <motion.button
      aria-label={label}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-[10px] text-silver transition-colors hover:bg-white/[0.06] hover:text-soft-white',
        className,
      )}
      onClick={(e) => {
        audioService.play('click')
        props.onClick?.(e)
      }}
      {...props}
    >
      {children}
    </motion.button>
  )
}
