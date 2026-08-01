import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@/components/ui'
import { useUIStore } from '@/stores/uiStore'
import { useOrbStore } from '@/stores/orbStore'
import { useChatStore } from '@/stores/chatStore'
import { audioService } from '@/services/audio'

interface QuickAction {
  id: string
  label: string
  icon: string
  run: () => void
}

export function QuickActions() {
  const navigate = useNavigate()
  const pushToast = useUIStore((s) => s.pushToast)
  const setPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen)
  const setOrbMode = useOrbStore((s) => s.setMode)
  const newConversation = useChatStore((s) => s.newConversation)

  const simulate = (title: string, message: string, mode?: 'processing' | 'listening' | 'thinking') => {
    if (mode) {
      setOrbMode(mode)
      window.setTimeout(() => useOrbStore.getState().setMode('completed'), 2000)
    }
    pushToast({ title, message, tone: 'info' })
  }

  const actions: QuickAction[] = [
    {
      id: 'voice',
      label: 'Voice Mode',
      icon: 'microphone',
      run: () => simulate('Voice mode ready', 'Listening, Sir.', 'listening'),
    },
    {
      id: 'newchat',
      label: 'New Chat',
      icon: 'chat',
      run: () => {
        newConversation()
        navigate('/assistant')
      },
    },
    {
      id: 'search',
      label: 'Search',
      icon: 'signal',
      run: () => setPaletteOpen(true),
    },
    {
      id: 'files',
      label: 'Files',
      icon: 'folder',
      run: () => navigate('/workspace'),
    },
    {
      id: 'notes',
      label: 'Notes',
      icon: 'document',
      run: () => navigate('/workspace'),
    },
    {
      id: 'calendar',
      label: 'Calendar',
      icon: 'calendar',
      run: () => simulate('Calendar synced', 'Today is fully optimized.'),
    },
    {
      id: 'email',
      label: 'Email',
      icon: 'email',
      run: () => simulate('Email summary', '3 important threads surfaced.'),
    },
    {
      id: 'automation',
      label: 'Automation',
      icon: 'bolt',
      run: () => navigate('/automation'),
    },
    {
      id: 'browser',
      label: 'Browser',
      icon: 'globe',
      run: () => simulate('Browser session', 'Opening research workspace.'),
    },
    {
      id: 'clipboard',
      label: 'Clipboard',
      icon: 'key',
      run: () => simulate('Clipboard synced', 'Latest copy stored to memory.'),
    },
    {
      id: 'screenshot',
      label: 'Screenshot',
      icon: 'download',
      run: () => simulate('Screenshot captured', 'Saved to workspace files.'),
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: 'settings',
      run: () => navigate('/settings'),
    },
  ]

  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {actions.map((a, i) => (
        <motion.button
          key={a.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03, duration: 0.35 }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => {
            audioService.play('click')
            a.run()
          }}
          className="group flex flex-col items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.03] px-2 py-3 transition-colors hover:border-accent/20 hover:bg-white/[0.05]"
        >
          <span className="grid size-9 place-items-center rounded-lg border border-white/[0.08] text-silver transition-colors group-hover:border-accent/20 group-hover:text-accent">
            <Icon name={a.icon} className="size-4" />
          </span>
          <span className="text-[10px] font-medium text-muted transition-colors group-hover:text-silver">
            {a.label}
          </span>
        </motion.button>
      ))}
    </div>
  )
}
