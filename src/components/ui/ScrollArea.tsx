import { cn } from '@/utils/cn'

export function ScrollArea({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div className={cn('min-h-0 flex-1 overflow-y-auto', className)} style={style}>
      {children}
    </div>
  )
}
