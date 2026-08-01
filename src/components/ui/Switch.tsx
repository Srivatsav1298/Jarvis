import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import { audioService } from '@/services/audio'

export function Switch({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  id?: string
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        audioService.play('click')
        onChange(!checked)
      }}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors',
        checked
          ? 'border-accent/40 bg-accent/25'
          : 'border-white/10 bg-white/[0.06]',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className={cn(
          'ml-0.5 block size-4.5 rounded-full shadow-sm',
          checked
            ? 'ml-[calc(100%-1.25rem)] bg-accent'
            : 'bg-silver/80',
        )}
      />
    </button>
  )
}
