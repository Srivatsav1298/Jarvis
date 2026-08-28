import { cn } from '@/utils/cn'

export type StatusTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'accent' | 'active'

const dot: Record<StatusTone, string> = {
  neutral: 'bg-silver',
  ok: 'bg-ok',
  warn: 'bg-warn',
  danger: 'bg-danger',
  accent: 'bg-accent',
  active: 'bg-accent',
}

export function StatusDot({
  tone = 'neutral',
  pulse = false,
  className,
}: {
  tone?: StatusTone
  pulse?: boolean
  className?: string
}) {
  return (
    <span className={cn('relative flex size-2', className)}>
      {pulse && (
        <span
          className={cn(
            'absolute inline-flex size-full animate-ping rounded-full opacity-40',
            dot[tone],
          )}
        />
      )}
      <span
        className={cn(
          'relative inline-flex size-2 rounded-full',
          dot[tone],
        )}
      />
    </span>
  )
}

export function StatusChip({
  tone = 'neutral',
  pulse = false,
  children,
  className,
}: {
  tone?: StatusTone
  pulse?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-silver',
        className,
      )}
    >
      <StatusDot tone={tone} pulse={pulse} />
      {children}
    </span>
  )
}
