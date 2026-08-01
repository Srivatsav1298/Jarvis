import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useUIStore } from '@/stores/uiStore'
import { useOrbStore } from '@/stores/orbStore'
import { useChatStore } from '@/stores/chatStore'
import { ALL_NAV } from '@/layouts/nav'
import { Icon, Kbd } from '@/components/ui'
import { cn } from '@/utils/cn'
import { audioService } from '@/services/audio'

interface Action {
  id: string
  label: string
  hint?: string
  icon: string
  group: 'Views' | 'Actions'
  keywords: string
  run: () => void
}

export function CommandPalette() {
  const open = useUIStore((s) => s.commandPaletteOpen)
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen)
  const setDockOpen = useUIStore((s) => s.setMemoryDockOpen)
  const pushToast = useUIStore((s) => s.pushToast)
  const setOrbMode = useOrbStore((s) => s.setMode)
  const newConversation = useChatStore((s) => s.newConversation)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const actions = useMemo<Action[]>(() => {
    const nav: Action[] = ALL_NAV.map((n) => ({
      id: `nav-${n.id}`,
      label: `Open ${n.label}`,
      hint: n.shortcut,
      icon: n.id === 'overview' ? 'home' : n.id === 'assistant' ? 'robot' : n.id === 'workspace' ? 'folder' : n.id === 'career' ? 'briefcase' : n.id === 'intelligence' ? 'newspaper' : n.id === 'automation' ? 'bolt' : n.id === 'memory' ? 'cpu' : n.id === 'system' ? 'server' : 'settings',
      group: 'Views',
      keywords: `${n.label} navigate view page`,
      run: () => navigate(n.path),
    }))

    const quick: Action[] = [
      {
        id: 'voice',
        label: 'Start Voice Mode',
        hint: 'Listening',
        icon: 'microphone',
        group: 'Actions',
        keywords: 'voice speak talk listen mic',
        run: () => {
          setOrbMode('listening')
          pushToast({ title: 'Voice mode ready', message: 'Listening, Sir.', tone: 'info' })
          window.setTimeout(() => setOrbMode('monitoring'), 4000)
        },
      },
      {
        id: 'newchat',
        label: 'New Conversation',
        hint: 'Assistant',
        icon: 'chat',
        group: 'Actions',
        keywords: 'chat new message assistant talk',
        run: () => {
          newConversation()
          navigate('/assistant')
        },
      },
      {
        id: 'scanjobs',
        label: 'Scan Jobs',
        hint: 'Career',
        icon: 'briefcase',
        group: 'Actions',
        keywords: 'jobs career market scan role',
        run: () => {
          setOrbMode('processing')
          pushToast({ title: 'Scanning job market', message: 'Checking 4 boards for new matches…', tone: 'info' })
          navigate('/career')
          window.setTimeout(() => setOrbMode('completed'), 2200)
        },
      },
      {
        id: 'reminder',
        label: 'Create Reminder',
        hint: 'Timeline',
        icon: 'clock',
        group: 'Actions',
        keywords: 'remind todo deadline reminder create',
        run: () => {
          pushToast({ title: 'Reminder created', message: 'Added to your timeline.', tone: 'success' })
        },
      },
      {
        id: 'summary',
        label: 'Generate Summary',
        hint: 'AI',
        icon: 'sparkles',
        group: 'Actions',
        keywords: 'summarize summary daily digest generate',
        run: () => {
          setOrbMode('thinking')
          pushToast({ title: 'Generating summary', message: 'Condensing today’s activity…', tone: 'info' })
          window.setTimeout(() => {
            setOrbMode('completed')
            pushToast({ title: 'Summary ready', message: 'View it in the Assistant.', tone: 'success' })
          }, 1800)
        },
      },
      {
        id: 'notes',
        label: 'Find Notes',
        hint: 'Workspace',
        icon: 'document',
        group: 'Actions',
        keywords: 'notes find workspace files search',
        run: () => navigate('/workspace'),
      },
      {
        id: 'memory',
        label: 'Toggle AI Memory',
        hint: 'Dock',
        icon: 'cpu',
        group: 'Actions',
        keywords: 'memory dock panel toggle pin',
        run: () => setDockOpen(!useUIStore.getState().memoryDockOpen),
      },
      {
        id: 'restart',
        label: 'Restart AI Engine',
        hint: 'System',
        icon: 'refresh',
        group: 'Actions',
        keywords: 'restart reboot engine ai reset system',
        run: () => {
          setOrbMode('processing')
          pushToast({ title: 'Restarting engine', message: 'Reinitializing STARC-N2…', tone: 'info' })
          window.setTimeout(() => {
            setOrbMode('completed')
            pushToast({ title: 'Engine online', message: 'All systems nominal.', tone: 'success' })
          }, 1600)
        },
      },
    ]

    return [...nav, ...quick]
  }, [navigate, newConversation, pushToast, setDockOpen, setOrbMode])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return actions
    return actions.filter((a) => a.label.toLowerCase().includes(q) || a.keywords.includes(q))
  }, [actions, query])

  useEffect(() => setIndex(0), [query])

  useEffect(() => {
    if (open) {
      setQuery('')
      window.setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setIndex((i) => Math.min(results.length - 1, i + 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setIndex((i) => Math.max(0, i - 1))
      }
      if (e.key === 'Enter' && results[index]) {
        e.preventDefault()
        runAction(results[index])
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, results, index])

  const runAction = (a: Action) => {
    audioService.play('activate')
    a.run()
    setOpen(false)
  }

  const groups = useMemo(() => {
    const out: Array<{ group: string; items: Action[] }> = []
    for (const a of results) {
      const existing = out.find((g) => g.group === a.group)
      if (existing) existing.items.push(a)
      else out.push({ group: a.group, items: [a] })
    }
    return out
  }, [results])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[14vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, scale: 0.98, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -10 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="glass-raised relative z-10 w-full max-w-xl overflow-hidden rounded-2xl shadow-pop"
          >
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-4">
              <Icon name="sparkles" className="size-4 shrink-0 text-accent" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commands and views…"
                aria-label="Command palette search"
                className="h-14 w-full bg-transparent text-[15px] text-soft-white placeholder:text-muted/60 focus:outline-none"
              />
              <Kbd>esc</Kbd>
            </div>

            <div className="max-h-[46vh] overflow-y-auto p-2">
              {groups.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-muted">
                  No results for “{query}”.
                </p>
              )}
              {groups.map((g) => (
                <div key={g.group} className="mb-1">
                  <p className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted">
                    {g.group}
                  </p>
                  {g.items.map((a) => {
                    const selected = results.indexOf(a) === index
                    return (
                      <button
                        key={a.id}
                        onMouseEnter={() => setIndex(results.indexOf(a))}
                        onClick={() => runAction(a)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors',
                          selected ? 'bg-accent/10 text-soft-white' : 'text-silver',
                        )}
                      >
                        <span
                          className={cn(
                            'grid size-7 shrink-0 place-items-center rounded-lg border border-white/10',
                            selected ? 'border-accent/20 text-accent' : 'text-muted',
                          )}
                        >
                          <Icon name={a.icon} className="size-3.5" />
                        </span>
                        <span className="flex-1 font-medium">{a.label}</span>
                        {a.hint && <span className="font-mono text-[10px] text-muted">{a.hint}</span>}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 border-t border-white/[0.06] px-4 py-2.5 text-[10px] text-muted">
              <span>↑↓ to navigate</span>
              <span>↵ to select</span>
              <span className="ml-auto">STARC · Command Center</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
