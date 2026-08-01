import { motion } from 'framer-motion'
import { panelTransition } from '@/animations/variants'
import { cn } from '@/utils/cn'

export function PageContainer({
  children,
  className,
  id,
}: {
  children: React.ReactNode
  className?: string
  id?: string
}) {
  return (
    <motion.div
      key="page"
      variants={panelTransition}
      initial="enter"
      animate="center"
      exit="exit"
      id={id}
      className={cn('h-full overflow-y-auto scroll-smooth', className)}
    >
      {children}
    </motion.div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', className)}>
      <div>
        {eyebrow && (
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-soft-white sm:text-[28px]">
          {title}
        </h1>
        {subtitle && <p className="mt-1 max-w-xl text-[13px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
