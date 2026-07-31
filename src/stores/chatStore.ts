import { create } from 'zustand'
import type { ChatMessage, Conversation, Suggestion } from '@/types'
import { uid } from '@/utils/random'
import { chatService } from '@/services/chat'

export const QUICK_PROMPTS: Suggestion[] = [
  { id: 'qp1', label: 'Summarize my day', prompt: 'Summarize my day and surface what I should focus on next.' },
  { id: 'qp2', label: 'Scan the job market', prompt: 'Scan the job market for new senior engineering roles matching my profile.' },
  { id: 'qp3', label: 'Draft an email', prompt: 'Draft a professional follow-up email about the interview tomorrow.' },
  { id: 'qp4', label: 'Optimize my calendar', prompt: 'Review my calendar and optimize my focus blocks for this week.' },
]

function seedConversations(): Conversation[] {
  const now = Date.now()
  const id = (s: string) => `${s}-${uid('c')}`
  return [
    {
      id: id('morning'),
      title: 'Morning Briefing',
      pinned: true,
      updatedAt: now - 1000 * 60 * 24,
      messages: [
        {
          id: uid('m'),
          role: 'user',
          content: 'Brief me for the day.',
          at: now - 1000 * 60 * 26,
        },
        {
          id: uid('m'),
          role: 'assistant',
          content:
            "Good morning, Sir. I've been monitoring your workspace since 06:02.\n\n- **18 new job opportunities** matched your profile overnight\n- **3 important emails** need attention\n- Your interview tomorrow is **confirmed** at 10:30\n- Weather looks favorable for the evening run\n\nYour calendar is optimized. I recommend starting with the **Portfolio Website** focus block at 09:00.",
          at: now - 1000 * 60 * 24,
        },
      ],
    },
    {
      id: id('resume'),
      title: 'Resume Tailoring',
      pinned: true,
      updatedAt: now - 1000 * 60 * 60 * 5,
      messages: [
        {
          id: uid('m'),
          role: 'user',
          content: 'Tailor my resume for the NVIDIA CUDA role.',
          at: now - 1000 * 60 * 60 * 6,
        },
        {
          id: uid('m'),
          role: 'assistant',
          content:
            "I've rewritten your resume's top section to emphasize **CUDA kernels**, **performance engineering**, and **LLM inference optimization** — matching 9 of 11 required skills for that role. Match probability rose from 68% to **91%**. Review the diff in Workspace → Files.",
          at: now - 1000 * 60 * 60 * 5,
        },
      ],
    },
    {
      id: id('code'),
      title: 'Vector Search Design',
      pinned: false,
      updatedAt: now - 1000 * 60 * 60 * 26,
      messages: [
        {
          id: uid('m'),
          role: 'user',
          content: 'Show me a HNSW index insertion in TypeScript.',
          at: now - 1000 * 60 * 60 * 27,
        },
        {
          id: uid('m'),
          role: 'assistant',
          content:
            'Here is a minimal HNSW insertion sketch:\n\n```ts\nfunction insert(points: number[][], entry: number[]): void {\n  // layered neighbor graph insertion\n  const layer = 0\n  const candidates = [entry]\n  points.push(entry)\n  return void layer\n}\n```\n\nWant me to extend it with efSearch and multi-layer navigation?',
          at: now - 1000 * 60 * 60 * 26,
        },
      ],
    },
  ]
}

interface ChatState {
  conversations: Conversation[]
  activeId: string
  query: string
  streaming: boolean
  controller: AbortController | null
  setActive: (id: string) => void
  newConversation: () => void
  deleteConversation: (id: string) => void
  togglePin: (id: string) => void
  setQuery: (q: string) => void
  sendMessage: (text: string) => Promise<void>
  stopStreaming: () => void
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
    conversations: seedConversations(),
    activeId: '',
    query: '',
    streaming: false,
    controller: null,

    setActive: (id) => set({ activeId: id }),

    newConversation: () => {
      const conv: Conversation = {
        id: uid('c'),
        title: 'New Conversation',
        pinned: false,
        updatedAt: Date.now(),
        messages: [],
      }
      set((s) => ({ conversations: [conv, ...s.conversations], activeId: conv.id }))
    },

    deleteConversation: (id) =>
      set((s) => {
        const remaining = s.conversations.filter((c) => c.id !== id)
        return {
          conversations: remaining,
          activeId: s.activeId === id ? remaining[0]?.id ?? '' : s.activeId,
        }
      }),

    togglePin: (id) =>
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === id ? { ...c, pinned: !c.pinned } : c,
        ),
      })),

    setQuery: (q) => set({ query: q }),

    sendMessage: async (text) => {
      const trimmed = text.trim()
      if (!trimmed) return
      const { activeId, conversations } = get()

      const conv =
        conversations.find((c) => c.id === activeId) ??
        (() => {
          const fresh: Conversation = {
            id: uid('c'),
            title: trimmed.slice(0, 42),
            pinned: false,
            updatedAt: Date.now(),
            messages: [],
          }
          set((s) => ({ conversations: [fresh, ...s.conversations], activeId: fresh.id }))
          return fresh
        })()

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
        for await (const chunk of chatService.stream(trimmed, controller.signal)) {
          acc += chunk
          updateAssistant(conv.id, assistantId, acc, true)
        }
        updateAssistant(conv.id, assistantId, acc, false)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          updateAssistant(
            conv.id,
            assistantId,
            acc || 'I encountered an issue while processing that request, Sir.',
            false,
          )
        }
      } finally {
        controller = null
        set({ streaming: false, controller: null })
      }
    },

    stopStreaming: () => {
      controller?.abort()
      set({ streaming: false })
    },
  }
})
