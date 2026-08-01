import { cn } from '@/utils/cn'

export function Avatar({
  name,
  hue = 190,
  size = 32,
  className,
}: {
  name: string
  hue?: number
  size?: number
  className?: string
}) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <span
      className={cn(
        'grid shrink-0 select-none place-items-center rounded-full border border-white/10 bg-gradient-to-br font-semibold text-soft-white',
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        backgroundImage: `linear-gradient(135deg, hsl(${hue} 25% 24%), hsl(${hue} 35% 14%))`,
      }}
      aria-hidden
    >
      {initials}
    </span>
  )
}

export function Separator({ className }: { className?: string }) {
  return <div role="separator" className={cn('h-px w-full bg-white/[0.06]', className)} />
}
