import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useUIStore } from '@/stores/uiStore'
import { NAV_GROUPS } from './nav'
import { cn } from '@/utils/cn'
import { Tooltip, Avatar, Separator } from '@/components/ui'
import { HiOutlineChevronLeft } from 'react-icons/hi2'
import { audioService } from '@/services/audio'

function BrandMark({ expanded }: { expanded: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <div className="relative grid size-9 shrink-0 place-items-center">
        <span className="absolute inset-0 rounded-full border border-white/10" />
        <span className="absolute inset-1 rounded-full border border-accent/40" />
        <span className="size-2.5 rounded-full bg-soft-white shadow-glow-cyan" />
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col"
          >
            <span className="text-sm font-bold tracking-[0.22em] text-soft-white">STARC</span>
            <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-muted">
              AI Operating System
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const toggleMemoryDock = useUIStore((s) => s.toggleMemoryDock)
  const memoryDockOpen = useUIStore((s) => s.memoryDockOpen)
  const profile = useUIStore((s) => s.profile)
  const [hover, setHover] = useState(false)

  const expanded = !collapsed || hover
  const width = expanded ? 236 : 72

  return (
    <motion.aside
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      animate={{ width }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      className="fixed inset-y-3 left-3 z-40 flex flex-col overflow-hidden rounded-2xl glass-raised"
      aria-label="Primary navigation"
    >
      <div className="flex h-16 items-center justify-between pr-3">
        <BrandMark expanded={expanded} />
        <button
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => {
            audioService.play('click')
            toggleSidebar()
          }}
          className="mr-1 grid size-7 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-soft-white"
        >
          <motion.span animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <HiOutlineChevronLeft className="size-4" />
          </motion.span>
        </button>
      </div>

      <Separator className="mx-3 w-auto" />

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.id} className="mb-4">
            {group.label && expanded && (
              <p className="mb-1.5 px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <SidebarItem key={item.id} {...item} expanded={expanded} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/[0.06] p-3">
        <button
          onClick={() => {
            audioService.play('click')
            toggleMemoryDock()
          }}
          className={cn(
            'mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors',
            memoryDockOpen
              ? 'bg-accent/10 text-accent'
              : 'text-silver hover:bg-white/[0.06] hover:text-soft-white',
          )}
        >
          <span className="relative grid size-5 shrink-0 place-items-center">
            <HiOutlineCpuChip className="size-[18px]" />
          </span>
          {expanded && <span className="truncate">AI Memory</span>}
          {expanded && (
            <span className="ml-auto rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] font-medium text-muted">
              DOCK
            </span>
          )}
        </button>

        <div className="flex items-center gap-3 px-3 py-1.5">
          <Avatar name={profile.name} hue={196} size={32} />
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                className="min-w-0 flex-1"
              >
                <p className="truncate text-[13px] font-semibold text-soft-white">{profile.name}</p>
                <p className="truncate text-[10px] text-muted">{profile.role}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  )
}

function SidebarItem({
  label,
  path,
  icon: Icon,
  shortcut,
  expanded,
}: {
  label: string
  path: string
  icon: React.ComponentType<{ className?: string }>
  shortcut: string
  expanded: boolean
}) {
  const item = (
    <NavLink
      to={path}
      end={path === '/'}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors',
          isActive ? 'text-soft-white' : 'text-silver hover:text-soft-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="nav-active"
              className="absolute inset-0 rounded-xl border border-white/10 bg-white/[0.07]"
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
          )}
          {isActive && (
            <motion.span
              layoutId="nav-indicator"
              className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent shadow-glow-cyan"
            />
          )}
          <span className="relative z-10 grid size-5 shrink-0 place-items-center">
            <Icon className={cn('size-[18px]', isActive ? 'text-accent' : 'text-current')} />
          </span>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="relative z-10 overflow-hidden whitespace-nowrap"
              >
                {label}
              </motion.span>
            )}
          </AnimatePresence>
        </>
      )}
    </NavLink>
  )

  if (!expanded) {
    return (
      <Tooltip label={`${label} · ${shortcut}`} side="right">
        {item}
      </Tooltip>
    )
  }
  return item
}
