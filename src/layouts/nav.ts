import type { ViewId } from '@/types'
import {
  HiOutlineBriefcase,
  HiOutlineChatBubbleLeftRight,
  HiOutlineCog6Tooth,
  HiOutlineCpuChip,
  HiOutlineHome,
  HiOutlineNewspaper,
  HiOutlineSparkles,
  HiOutlineSquares2X2,
  HiOutlineBolt,
} from 'react-icons/hi2'

export interface NavItem {
  id: ViewId
  label: string
  path: string
  icon: React.ComponentType<{ className?: string }>
  shortcut: string
}

export interface NavGroup {
  id: string
  label?: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'command',
    label: 'Command',
    items: [
      { id: 'overview', label: 'Overview', path: '/', icon: HiOutlineHome, shortcut: 'g o' },
      { id: 'assistant', label: 'Assistant', path: '/assistant', icon: HiOutlineChatBubbleLeftRight, shortcut: 'g a' },
    ],
  },
  {
    id: 'work',
    label: 'Workspace',
    items: [
      { id: 'workspace', label: 'Workspace', path: '/workspace', icon: HiOutlineSquares2X2, shortcut: 'g w' },
    ],
  },
  {
    id: 'career',
    label: 'Career',
    items: [
      { id: 'career', label: 'Career', path: '/career', icon: HiOutlineBriefcase, shortcut: 'g c' },
      { id: 'intelligence', label: 'Intelligence', path: '/intelligence', icon: HiOutlineNewspaper, shortcut: 'g i' },
    ],
  },
  {
    id: 'control',
    label: 'Control',
    items: [
      { id: 'automation', label: 'Automation', path: '/automation', icon: HiOutlineBolt, shortcut: 'g u' },
      { id: 'memory', label: 'Memory', path: '/memory', icon: HiOutlineCpuChip, shortcut: 'g m' },
      { id: 'system', label: 'System', path: '/system', icon: HiOutlineSparkles, shortcut: 'g s' },
    ],
  },
  {
    id: 'prefs',
    items: [
      { id: 'settings', label: 'Settings', path: '/settings', icon: HiOutlineCog6Tooth, shortcut: 'g ,' },
    ],
  },
]

export const ALL_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)

export function navItemById(id: ViewId): NavItem | undefined {
  return ALL_NAV.find((n) => n.id === id)
}
