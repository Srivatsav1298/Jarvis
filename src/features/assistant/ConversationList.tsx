import { motion } from 'framer-motion'
import { useChatStore } from '@/stores/chatStore'
import { SearchInput, ContextMenu } from '@/components/ui'
import { HiOutlineMapPin, HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi2'
import { relativeTime } from '@/utils/format'
import { cn } from '@/utils/cn'
import { audioService } from '@/services/audio'
import type { Conversation } from '@/types'

function preview(conv: Conversation): string {
  const last = conv.messages[conv.messages.length - 1]
  if (!last) return 'New conversation'
  if (last.role === 'user') return last.content.slice(0, 60)
  return last.content.replace(/[#*`>|]/g, '').slice(0, 60)
}

function ConversationRow({ conv, active }: { conv: Conversation; active: boolean }) {
  const setActive = useChatStore((s) => s.setActive)
  const togglePin = useChatStore((s) => s.togglePin)
  const deleteConversation = useChatStore((s) => s.deleteConversation)

  return (
    <ContextMenu
      label={`Actions for ${conv.title}`}
      items={[
        { id: 'pin', label: conv.pinned ? 'Unpin' : 'Pin', icon: <HiOutlineMapPin />, onSelect: () => togglePin(conv.id) },
        { id: 'del', label: 'Delete', danger: true, icon: <HiOutlineTrash />, onSelect: () => deleteConversation(conv.id) },
      ]}
    >
      <button
        onClick={() => {
          audioService.play('click')
          setActive(conv.id)
        }}
        aria-current={active}
        className={cn(
          'group flex w-full flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left transition-colors',
          active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]',
        )}
      >
        <span className="flex items-center gap-2">
          {conv.pinned && <HiOutlineMapPin className="size-3 shrink-0 text-accent" />}
          <span className={cn('truncate text-[13px] font-medium', active ? 'text-soft-white' : 'text-silver')}>
            {conv.title}
          </span>
        </span>
        <span className="truncate text-[11px] text-muted">
          {preview(conv)} · {relativeTime(conv.updatedAt)}
        </span>
      </button>
    </ContextMenu>
  )
}

export function ConversationList() {
  const conversations = useChatStore((s) => s.conversations)
  const activeId = useChatStore((s) => s.activeId)
  const query = useChatStore((s) => s.query)
  const setQuery = useChatStore((s) => s.setQuery)
  const newConversation = useChatStore((s) => s.newConversation)

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const pinned = filtered.filter((c) => c.pinned)
  const rest = filtered.filter((c) => !c.pinned)

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b border-white/[0.06] p-4">
        <button
          onClick={newConversation}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] py-2.5 text-[13px] font-medium text-soft-white transition-colors hover:border-accent/25 hover:bg-white/[0.08]"
        >
          <HiOutlinePlus className="size-4" />
          New Conversation
        </button>
        <SearchInput value={query} onChange={setQuery} onClear={() => setQuery('')} placeholder="Search conversations…" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {pinned.length > 0 && (
          <SectionLabel>Pinned</SectionLabel>
        )}
        <div className="space-y-0.5">
          {pinned.map((c) => (
            <ConversationRow key={c.id} conv={c} active={c.id === activeId} />
          ))}
        </div>

        {rest.length > 0 && <SectionLabel>Recent</SectionLabel>}
        <div className="space-y-0.5">
          {rest.map((c) => (
            <ConversationRow key={c.id} conv={c} active={c.id === activeId} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-muted">
            No conversations match “{query}”.
          </div>
        )}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mb-1 mt-2 px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted"
    >
      {children}
    </motion.p>
  )
}
