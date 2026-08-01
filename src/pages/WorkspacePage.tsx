import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PageContainer, PageHeader } from '@/features/shared/PageContainer'
import { useMemoryStore } from '@/stores/memoryStore'
import { useUIStore } from '@/stores/uiStore'
import { Badge, Button, Icon, ProgressBar, Tabs } from '@/components/ui'
import { cn } from '@/utils/cn'
import { uid } from '@/utils/random'

const FILES = [
  { id: 'f1', name: 'resume-v3.pdf', size: '412 KB', kind: 'document' },
  { id: 'f2', name: 'portfolio.zip', size: '8.2 MB', kind: 'folder' },
  { id: 'f3', name: 'cover-letter.md', size: '3 KB', kind: 'document' },
  { id: 'f4', name: 'salary-benchmarks.xlsx', size: '28 KB', kind: 'document' },
  { id: 'f5', name: 'STARC-briefings', size: '—', kind: 'folder' },
  { id: 'f6', name: 'interview-notes', size: '—', kind: 'folder' },
]

interface Note {
  id: string
  title: string
  body: string
  updatedAt: string
}

const SEED_NOTES: Note[] = [
  { id: 'n1', title: 'Interview: Staff ML Engineer', body: 'Ask about inference infra at scale. They use vLLM + custom routers. Prep: talk about the token-stream mock I built.', updatedAt: 'Today 09:12' },
  { id: 'n2', title: 'Salary anchor', body: 'Market says 220-260k base for this region. Anchor at 240k, floor at 205k + equity. Competing offer at 215k.', updatedAt: 'Yesterday 18:40' },
  { id: 'n3', title: 'STARC roadmap', body: 'Ship workspace dock next, then automation triggers. Keep orb calm — energy only when working.', updatedAt: 'Aug 1' },
]

export default function WorkspacePage() {
  const [tab, setTab] = useState('notes')
  const projects = useMemoryStore((s) => s.projects)
  const pushToast = useUIStore((s) => s.pushToast)

  const [notes, setNotes] = useState<Note[]>(SEED_NOTES)
  const [selectedNote, setSelectedNote] = useState<string | null>('n1')

  const addNote = () => {
    const note: Note = { id: uid('n'), title: 'Untitled note', body: '', updatedAt: 'Just now' }
    setNotes((n) => [note, ...n])
    setSelectedNote(note.id)
    pushToast({ title: 'Note created', message: 'Captured to workspace.', tone: 'success' })
  }

  const activeNote = notes.find((n) => n.id === selectedNote) ?? notes[0]

  return (
    <PageContainer className="p-5 sm:p-6 lg:p-8">
      <div className="mx-auto flex h-full max-w-[1500px] flex-col">
        <PageHeader
          eyebrow="Workspace"
          title="Command Deck"
          subtitle="Files, notes, projects and tools in one dock"
        />

        <Tabs
          className="mb-4"
          active={tab}
          onChange={setTab}
          items={[
            { id: 'notes', label: 'Notes', icon: <Icon name="document" className="size-3.5" /> },
            { id: 'files', label: 'Files', icon: <Icon name="folder" className="size-3.5" /> },
            { id: 'projects', label: 'Projects', icon: <Icon name="target" className="size-3.5" /> },
            { id: 'browser', label: 'Browser', icon: <Icon name="globe" className="size-3.5" /> },
            { id: 'terminal', label: 'Terminal', icon: <Icon name="code" className="size-3.5" /> },
          ]}
        />

        <div className="glass flex-1 overflow-hidden rounded-card">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="h-full"
            >
              {tab === 'notes' && (
                <div className="grid h-full md:grid-cols-[260px_1fr]">
                  <div className="flex flex-col border-r border-white/[0.06]">
                    <div className="flex items-center justify-between border-b border-white/[0.06] p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Notes</p>
                      <Button size="sm" variant="secondary" icon={<Icon name="plus" className="size-3.5" />} onClick={addNote}>
                        New
                      </Button>
                    </div>
                    <div className="flex-1 space-y-1 overflow-y-auto p-2">
                      {notes.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => setSelectedNote(n.id)}
                          className={cn(
                            'w-full rounded-lg px-3 py-2 text-left transition-colors',
                            n.id === activeNote?.id ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]',
                          )}
                        >
                          <p className="truncate text-[12.5px] font-medium text-soft-white">{n.title}</p>
                          <p className="truncate text-[10.5px] text-muted">{n.body || 'Empty note'} · {n.updatedAt}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  {activeNote && (
                    <div className="flex min-h-0 flex-col">
                      <div className="border-b border-white/[0.06] p-4">
                        <input
                          value={activeNote.title}
                          onChange={(e) => setNotes((ns) => ns.map((x) => (x.id === activeNote.id ? { ...x, title: e.target.value } : x)))}
                          className="w-full bg-transparent text-[15px] font-semibold text-soft-white focus:outline-none"
                          aria-label="Note title"
                        />
                        <p className="mt-1 text-[11px] text-muted">Edited {activeNote.updatedAt}</p>
                      </div>
                      <textarea
                        value={activeNote.body}
                        onChange={(e) => setNotes((ns) => ns.map((x) => (x.id === activeNote.id ? { ...x, body: e.target.value } : x)))}
                        placeholder="Start typing…"
                        aria-label="Note body"
                        className="min-h-0 flex-1 resize-none bg-transparent p-4 text-[13px] leading-relaxed text-silver placeholder:text-muted/50 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {tab === 'files' && (
                <div className="p-4">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {FILES.map((f, i) => (
                      <motion.button
                        key={f.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => pushToast({ title: f.name, message: `Opening ${f.size === '—' ? 'folder' : 'file'}…`, tone: 'info' })}
                        className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.03] p-3 text-left transition-colors hover:border-white/10 hover:bg-white/[0.06]"
                      >
                        <span className="grid size-9 place-items-center rounded-lg bg-white/[0.05] text-silver">
                          <Icon name={f.kind === 'folder' ? 'folder' : 'document'} className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-medium text-soft-white">{f.name}</p>
                          <p className="text-[11px] text-muted">{f.kind === 'folder' ? 'Folder' : f.size}</p>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                  <div className="mt-4 rounded-xl border border-accent/15 bg-accent/[0.04] p-3 text-[12px] text-silver">
                    <Icon name="cloud" className="mr-1.5 inline size-3.5 text-accent" />
                    Synced · 6 items across <span className="font-mono text-accent">~/STARC</span> (files are stubbed for the frontend build)
                  </div>
                </div>
              )}

              {tab === 'projects' && (
                <div className="space-y-3 p-4">
                  {projects.map((p, i) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="rounded-xl border border-white/[0.05] bg-white/[0.03] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-semibold text-soft-white">{p.name}</p>
                          <p className="truncate text-[11.5px] text-muted">{p.description}</p>
                        </div>
                        <Badge tone={p.status === 'active' ? 'ok' : p.status === 'paused' ? 'warn' : 'accent'}>{p.status}</Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <ProgressBar value={p.progress} tone="accent" className="flex-1" />
                        <span className="font-mono text-[11px] text-muted">{Math.round(p.progress * 100)}%</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {tab === 'browser' && <BrowserPanel pushToast={pushToast} />}

              {tab === 'terminal' && <TerminalPanel />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </PageContainer>
  )
}

function BrowserPanel({ pushToast }: { pushToast: (t: { title: string; message?: string; tone: 'info' | 'success' | 'warning' | 'error' }) => void }) {
  const [url, setUrl] = useState('starc://intel/ai-labor-market')
  const [history, setHistory] = useState<string[]>(['starc://overview'])
  const [tabs, setTabs] = useState(['starc://intel/ai-labor-market', 'starc://briefing', 'starc://career/tracked'])
  const [activeTab, setActiveTab] = useState(0)

  const navigate = (next: string) => {
    const clean = next.trim()
    if (!clean) return
    setUrl(clean)
    setHistory((h) => [clean, ...h].slice(0, 20))
    pushToast({ title: 'Navigated', message: clean, tone: 'info' })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-white/[0.06] p-2">
        <div className="no-scrollbar flex flex-1 items-center gap-1 overflow-x-auto">
          {tabs.map((t, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className={cn(
                'flex max-w-[180px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] transition-colors',
                i === activeTab ? 'bg-white/[0.08] text-soft-white' : 'text-muted hover:text-silver',
              )}
            >
              <Icon name="globe" className="size-3 shrink-0" />
              <span className="truncate">{t.replace('starc://', '')}</span>
            </button>
          ))}
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            const id = `starc://new/${tabs.length + 1}`
            setTabs((t) => [...t, id])
            setActiveTab(tabs.length)
            setUrl(id)
          }}
        >
          <Icon name="plus" className="size-3.5" />
        </Button>
      </div>

      <div className="flex items-center gap-2 border-b border-white/[0.06] p-2">
        <IconButtonSmall label="Back" onClick={() => navigate(history[1] ?? url)} icon="chevronLeft" />
        <IconButtonSmall label="Forward" onClick={() => pushToast({ title: 'No forward history', tone: 'info' })} icon="chevronRight" />
        <IconButtonSmall label="Refresh" onClick={() => pushToast({ title: 'Refreshed', message: url, tone: 'success' })} icon="refresh" />
        <form className="flex-1" onSubmit={(e) => { e.preventDefault(); navigate(url) }}>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-label="Address bar"
            className="h-8 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 font-mono text-[12px] text-soft-white focus:outline-none"
          />
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">STARC Browser · {activeTab + 1}/{tabs.length}</p>
          <h2 className="mt-2 text-xl font-semibold text-soft-white">AI Labor Market Pulse</h2>
          <p className="mt-1 text-[13px] text-muted">Live index · updated 12s ago</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: 'Active roles', value: '48.2k' },
              { label: 'Median salary', value: '$212k' },
              { label: 'Remote share', value: '61%' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/[0.05] bg-white/[0.03] p-3 text-center">
                <p className="font-mono text-lg font-semibold text-soft-white">{s.value}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-accent/15 bg-accent/[0.04] p-4 text-[12.5px] leading-relaxed text-silver">
            <p><span className="font-semibold text-soft-white">Signal:</span> demand for staff-level inference engineers up 18% QoQ. Matching you: 3 roles ranked "top", 2 new since yesterday.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function IconButtonSmall({ label, onClick, icon }: { label: string; onClick: () => void; icon: string }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-soft-white"
    >
      <Icon name={icon} className="size-3.5" />
    </button>
  )
}

function TerminalPanel() {
  const [lines, setLines] = useState<string[]>([
    'STARC v2.4.1 shell — type help',
    '> status',
    'engine: online | load 27% | memory graph 1,248 nodes',
    '> ',
  ])
  const [input, setInput] = useState('')

  const run = (cmd: string) => {
    const out: string[] = []
    switch (cmd.trim().toLowerCase()) {
      case 'help':
        out.push('help, status, jobs, memory, news, clear')
        break
      case 'status':
        out.push('engine online · load 27% · orb idle · 0 active jobs')
        break
      case 'jobs':
        out.push('3 matches: Staff ML (92%) · Sr Systems (88%) · Applied AI (84%)')
        break
      case 'memory':
        out.push('1,248 nodes · 3 projects · 9 goals · 14 pinned facts')
        break
      case 'news':
        out.push('5 unread intelligence signals · top: "Inference demand up 18% QoQ"')
        break
      case 'clear':
        setLines([])
        return
      default:
        out.push(`command not found: ${cmd}`)
    }
    setLines((l) => [...l, ...out, '> '])
  }

  return (
    <div className="flex h-full flex-col font-mono text-[12.5px]">
      <div className="flex-1 overflow-y-auto p-4 leading-relaxed">
        {lines.map((l, i) => (
          <p key={i} className={cn('whitespace-pre-wrap', l.startsWith('>') ? 'text-accent' : 'text-silver')}>
            {l || '\u00A0'}
          </p>
        ))}
      </div>
      <form
        className="flex items-center gap-2 border-t border-white/[0.06] p-3"
        onSubmit={(e) => { e.preventDefault(); if (input.trim()) run(input); setInput('') }}
      >
        <span className="text-accent">&gt;</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="Terminal input"
          spellCheck={false}
          autoComplete="off"
          className="flex-1 bg-transparent font-mono text-[12.5px] text-soft-white focus:outline-none"
        />
      </form>
    </div>
  )
}
