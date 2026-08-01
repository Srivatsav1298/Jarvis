import { motion } from 'framer-motion'
import type { ChatMessage } from '@/types'
import { Markdown } from './Markdown'
import { Avatar } from '@/components/ui'
import { cn } from '@/utils/cn'
import { useUIStore } from '@/stores/uiStore'

export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-2" aria-label="STARC is thinking">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-accent/70"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const profile = useUIStore((s) => s.profile)
  const isUser = message.role === 'user'

  if (message.role === 'system') {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] text-muted">
          {message.content}
        </span>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn('flex w-full gap-3', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-full border border-accent/30 bg-accent/10">
          <span className="size-2 rounded-full bg-accent" />
        </span>
      )}

      <div className={cn('max-w-[82%] sm:max-w-[74%]', isUser && 'flex flex-col items-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3',
            isUser
              ? 'rounded-br-md border border-white/10 bg-soft-white/[0.08] text-soft-white'
              : 'rounded-bl-md border border-white/[0.06] bg-white/[0.03]',
          )}
        >
          {message.streaming && message.content.length === 0 ? (
            <ThinkingIndicator />
          ) : isUser ? (
            <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-soft-white">
              {message.content}
            </p>
          ) : (
            <Markdown content={message.content} />
          )}

          {message.streaming && message.content.length > 0 && (
            <motion.span
              aria-hidden
              className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-[2px] bg-accent"
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 0.9, repeat: Infinity }}
            />
          )}
        </div>

        {isUser && (
          <div className="mt-1 flex items-center gap-1.5 pr-1">
            <Avatar name={profile.name} size={16} className="opacity-70" />
          </div>
        )}
      </div>
    </motion.div>
  )
}
