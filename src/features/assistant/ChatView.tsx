import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useChatStore } from '@/stores/chatStore'
import { ConversationList } from './ConversationList'
import { MessageBubble } from './MessageBubble'
import { Composer } from './Composer'
import { Badge, EmptyState, Icon, Menu } from '@/components/ui'
import { HiOutlineChevronDown, HiOutlineMapPin, HiOutlineSquares2X2 } from 'react-icons/hi2'
import { cn } from '@/utils/cn'

export function ChatView() {
  const conversations = useChatStore((s) => s.conversations)
  const activeId = useChatStore((s) => s.activeId)
  const setActive = useChatStore((s) => s.setActive)
  const togglePin = useChatStore((s) => s.togglePin)
  const newConversation = useChatStore((s) => s.newConversation)
  const [mobileList, setMobileList] = useState(false)

  useEffect(() => {
    if (!activeId && conversations.length > 0) setActive(conversations[0].id)
  }, [activeId, conversations, setActive])

  const conv = conversations.find((c) => c.id === activeId)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const streamLen = useMemo(() => {
    const last = conv?.messages[conv.messages.length - 1]
    return last?.streaming ? last.content.length : 0
  }, [conv])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [conv?.messages.length, streamLen])

  return (
    <div className="flex h-full">
      {/* Conversation list */}
      <div
        className={cn(
          'absolute inset-y-0 left-0 z-20 w-[280px] max-w-[80vw] border-r border-white/[0.06] bg-graphite/60 backdrop-blur-2xl transition-transform md:static md:z-auto md:translate-x-0 md:bg-transparent md:backdrop-blur-none',
          mobileList ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <ConversationList />
      </div>
      {mobileList && (
        <button
          aria-label="Close conversation list"
          onClick={() => setMobileList(false)}
          className="fixed inset-0 z-10 bg-black/40 md:hidden"
        />
      )}

      {/* Chat column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] px-4 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setMobileList(true)}
              aria-label="Open conversations"
              className="grid size-8 place-items-center rounded-lg text-muted hover:bg-white/[0.06] md:hidden"
            >
              <HiOutlineSquares2X2 className="size-4" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-soft-white">{conv?.title ?? 'STARC Assistant'}</p>
              <p className="flex items-center gap-1.5 text-[10px] text-muted">
                <span className="size-1.5 rounded-full bg-ok" />
                STARC · thinking with you
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {conv && (
              <Menu
                trigger={
                  <span className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-soft-white">
                    <HiOutlineChevronDown className="size-4" />
                  </span>
                }
                items={[
                  {
                    id: 'pin',
                    label: conv.pinned ? 'Unpin conversation' : 'Pin conversation',
                    icon: <HiOutlineMapPin />,
                    onSelect: () => togglePin(conv.id),
                  },
                  {
                    id: 'new',
                    label: 'New conversation',
                    icon: <HiOutlineSquares2X2 />,
                    onSelect: () => newConversation(),
                  },
                ]}
              />
            )}
            <Badge tone="accent" className="hidden sm:inline-flex">
              N2 · 12k tokens
            </Badge>
          </div>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8">
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            <AnimatePresence mode="popLayout">
              {conv?.messages.map((m) => <MessageBubble key={m.id} message={m} />)}
            </AnimatePresence>

            {conv && conv.messages.length === 0 && (
              <EmptyState
                icon={<Icon name="robot" className="size-6" />}
                title="A new thread, Sir"
                description="STARC is ready. Ask anything — or use a quick prompt below to get started."
                className="py-16"
              />
            )}

            {!conv && (
              <EmptyState
                icon={<Icon name="chat" className="size-6" />}
                title="Start a conversation"
                description="Create a new thread to begin speaking with STARC."
                className="py-16"
              />
            )}
          </div>
        </div>

        <Composer />
      </div>
    </div>
  )
}
