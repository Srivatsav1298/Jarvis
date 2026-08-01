import { iconRegistry, type IconType } from '@/icons'

export function Icon({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const Cmp: IconType | undefined = iconRegistry[name]
  if (!Cmp) return null
  return <Cmp className={className} />
}
