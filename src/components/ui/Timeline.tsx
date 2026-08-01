import { cn } from '@/utils/cn'

export function Timeline({
  items,
  renderItem,
  className,
}: {
  items: Array<{ id: string }>
  renderItem: (item: { id: string }, index: number) => React.ReactNode
  className?: string
}) {
  return (
    <ol className={cn('space-y-0', className)}>
      {items.map((item, index) => (
        <li key={item.id} className="relative flex gap-3 pb-1">
          <span className="relative flex flex-col items-center">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-white/25 ring-4 ring-white/[0.04]" />
            {index < items.length - 1 && (
              <span className="my-1 w-px flex-1 bg-white/[0.07]" />
            )}
          </span>
          <div className="min-w-0 flex-1 pb-4">{renderItem(item, index)}</div>
        </li>
      ))}
    </ol>
  )
}
