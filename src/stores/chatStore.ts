import { create } from 'zustand'
import type { ChatMessage, Conversation, Suggestion } from '@/types'
import { uid } from '@/utils/random'
import { streamChat } from '@/services/chat'
import { api } from '@/services/api'
import { speak } from '@/services/voice'
import { useUIStore } from '@/stores/uiStore'
import { useVoiceStore } from '@/stores/voiceStore'

export const QUICK_PROMPTS: Suggestion[] = [
  { id: 'qp1', label: 'Summarize my day', prompt: 'Summarize my day and surface what I should focus on next.' },
  { id: 'qp2', label: 'Scan the job market', prompt: 'Scan the job market for new senior engineering roles matching my profile.' },
  { id: 'qp3', label: 'Draft an email', prompt: 'Draft a professional follow-up email about the interview tomorrow.' },
  { id: 'qp4', label: 'Optimize my calendar', prompt: 'Review my calendar and optimize my focus blocks for this week.' },
]

interface ApiConversation {
  id: string
  title: string
  pinned: boolean
  last_activity: string | null
  message_count: number
  messages?: Array<{
    id: string
    role: string
    content: string
    created_at: string
  }>
}

function toConversation(c: ApiConversation): Conversation {
  return {
    id: c.id,
    title: c.title,
    pinned: c.pinned,
    updatedAt: c.last_activity ? new Date(c.last_activity).getTime() : Date.now(),
    messages: (c.messages ?? []).map((m) => ({
      id: m.id,
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
      at: new Date(m.created_at).getTime(),
    })),
  }
}

interface ChatState {
  conversations: Conversation[]
  activeId: string
  query: string
  streaming: boolean
  controller: AbortController | null
  loaded: boolean
  loadConversations: () => Promise<void>
  setActive: (id: string) => void
  newConversation: () => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  togglePin: (id: string) => Promise<void>
  setQuery: (q: string) => void
  sendMessage: (text: string, options?: { speak?: boolean }) => Promise<string>
  stopStreaming: () => void
}

// Voice turns provide their own speech callbacks for barge-in/continuous mode.
// This one-shot handoff preserves the public sendMessage(text) call shape.
let suppressNextAutoSpeech = false
export function suppressNextChatAutoSpeech(): void {
  suppressNextAutoSpeech = true
}

export const useChatStore = create<ChatState>()((set, get) => {
  let controller: AbortController | null = null

  const appendMessage = (convId: string, msg: ChatMessage) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === convId
          ? {
              ...c,
              updatedAt: Date.now(),
              messages: [...c.messages, msg],
            }
          : c,
      ),
    }))
  }

  const updateAssistant = (convId: string, msgId: string, content: string, streaming: boolean) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === convId
          ? {
              ...c,
              updatedAt: Date.now(),
              messages: c.messages.map((m) =>
                m.id === msgId ? { ...m, content, streaming } : m,
              ),
            }
          : c,
      ),
    }))
  }

  return {
    conversations: [],
    activeId: '',
    query: '',
    streaming: false,
    controller: null,
    loaded: false,

    loadConversations: async () => {
      try {
        const data = await api.get<{ items: ApiConversation[] }>('/conversations')
        const convs = (data.items ?? []).map(toConversation)
        set({
          conversations: convs,
          activeId: get().activeId || convs[0]?.id || '',
          loaded: true,
        })
      } catch {
        set({ loaded: true })
      }
    },

    setActive: (id) => set({ activeId: id }),

    newConversation: async () => {
      const local: Conversation = {
        id: uid('c'),
        title: 'New Conversation',
        pinned: false,
        updatedAt: Date.now(),
        messages: [],
      }
      set((s) => ({ conversations: [local, ...s.conversations], activeId: local.id }))
      try {
        const created = await api.post<ApiConversation>('/conversations', {
          title: 'New Conversation',
        })
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === local.id ? { ...c, id: created.id } : c,
          ),
          activeId: s.activeId === local.id ? created.id : s.activeId,
        }))
      } catch {
        // keep the optimistic local row if the API is unreachable
      }
    },

    deleteConversation: async (id) => {
      const remaining = get().conversations.filter((c) => c.id !== id)
      set({
        conversations: remaining,
        activeId: get().activeId === id ? remaining[0]?.id ?? '' : get().activeId,
      })
      try {
        await api.del(`/conversations/${id}`)
      } catch {
        // local removal already applied
      }
    },

    togglePin: async (id) => {
      const target = get().conversations.find((c) => c.id === id)
      if (!target) return
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === id ? { ...c, pinned: !c.pinned } : c,
        ),
      }))
      try {
        await api.patch(`/conversations/${id}`, { pinned: !target.pinned })
      } catch {
        // revert on failure
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, pinned: target.pinned } : c,
          ),
        }))
      }
    },

    setQuery: (q) => set({ query: q }),

    sendMessage: async (text, options = {}) => {
      const trimmed = text.trim()
      if (!trimmed) return ''
      const { activeId, conversations } = get()

      const conv =
        conversations.find((c) => c.id === activeId) ?? {
          id: uid('c'),
          title: trimmed.slice(0, 42),
          pinned: false,
          updatedAt: Date.now(),
          messages: [],
        }

      if (!conversations.some((c) => c.id === conv.id)) {
        set((s) => ({ conversations: [conv, ...s.conversations], activeId: conv.id }))
      }

      const userMsg: ChatMessage = {
        id: uid('m'),
        role: 'user',
        content: trimmed,
        at: Date.now(),
      }
      appendMessage(conv.id, userMsg)

      const assistantId = uid('m')
      appendMessage(conv.id, {
        id: assistantId,
        role: 'assistant',
        content: '',
        at: Date.now(),
        streaming: true,
      })

      controller = new AbortController()
      set({ streaming: true, controller })

      let acc = ''
      try {
        for await (const chunk of streamChat({
          conversationId: conv.id,
          prompt: trimmed,
          signal: controller.signal,
        })) {
          acc += chunk
          updateAssistant(conv.id, assistantId, acc, true)
        }
        updateAssistant(conv.id, assistantId, acc, false)
      } catch (err) {
        if ((err as Error).name !== 'AbortError' && !controller.signal.aborted) {
          const fallback = 'I encountered an issue while processing that request, Sir.'
          acc = acc || fallback
          updateAssistant(conv.id, assistantId, acc, false)
        }
      } finally {
        controller = null
        set({ streaming: false, controller: null })
      }
      const shouldAutoSpeak = !suppressNextAutoSpeech
      suppressNextAutoSpeech = false
      if (acc && options.speak !== false && shouldAutoSpeak) {
        const voice = useVoiceStore.getState()
        if (voice.enabled && voice.autoSpeak) {
          speak(acc, {
            rate: voice.rate,
            pitch: voice.pitch,
            volume: voice.volume,
            voiceName: voice.voiceName,
            onerror: (message) => {
              useUIStore.getState().pushToast({
                title: 'Voice unavailable',
                message,
                tone: 'error',
              })
            },
          })
        }
      }
      return acc
    },

    stopStreaming: () => {
      controller?.abort()
      set({ streaming: false })
    },
  }
})
