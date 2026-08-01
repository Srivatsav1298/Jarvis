import { forwardRef } from 'react'
import { cn } from '@/utils/cn'

export const Slider = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="range"
    className={cn(
      'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10',
      'accent-accent',
      className,
    )}
    {...props}
  />
))
Slider.displayName = 'Slider'
