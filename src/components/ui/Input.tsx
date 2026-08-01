import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

const inputBase =
  'w-full rounded-[10px] border border-white/10 bg-white/[0.04] px-3.5 text-sm text-soft-white placeholder:text-muted/70 transition-all focus:border-accent/40 focus:bg-white/[0.06] focus:shadow-[0_0_0_3px_rgba(167,227,255,0.08)] focus:outline-none'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(inputBase, 'h-10', className)} {...props} />
  ),
)
Input.displayName = 'Input'

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(inputBase, 'min-h-[88px] resize-none py-2.5 leading-relaxed', className)}
    {...props}
  />
))
Textarea.displayName = 'Textarea'
