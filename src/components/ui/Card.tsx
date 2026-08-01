import { forwardRef, type HTMLAttributes } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/utils/cn'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
}

/** Raised glass surface. The primary panel primitive. */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive, children, ...props }, ref) => {
    const cls = cn(
      'glass relative rounded-card',
      interactive &&
        'transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-white/10 hover:shadow-raise',
      className,
    )

    if (interactive) {
      return (
        <motion.div
          ref={ref}
          whileHover={{ y: -2 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className={cls}
          {...(props as HTMLMotionProps<'div'>)}
        >
          {children}
        </motion.div>
      )
    }

    return (
      <div ref={ref} className={cls} {...props}>
        {children}
      </div>
    )
  },
)
Card.displayName = 'Card'

export function GlassPanel({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('glass-raised rounded-card', className)} {...props}>
      {children}
    </div>
  )
}

export function PanelHeader({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && (
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-silver [&>svg]:size-4">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-[13px] font-semibold tracking-tight text-soft-white">
            {title}
          </h2>
          {subtitle && (
            <p className="truncate text-xs text-muted">{subtitle}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  )
}
