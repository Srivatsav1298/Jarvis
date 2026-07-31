import type { PresenceMode } from '@/types'

const PRESENCE: Record<PresenceMode, string[]> = {
  monitoring: [
    'Monitoring your workspace',
    'Watching background signals',
    'Keeping an eye on your systems',
    'Running silent diagnostics',
  ],
  scanning: [
    'Scanning the job market',
    'Watching new opportunities',
    'Tracking competitor roles',
    'Monitoring salary movements',
  ],
  preparing: [
    "Preparing today's schedule",
    'Optimizing your calendar',
    'Organizing your focus blocks',
    'Reordering tomorrow’s priorities',
  ],
  summarizing: [
    'Summarizing recent activity',
    'Condensing your intelligence feed',
    'Drafting your daily summary',
    'Indexing today’s changes',
  ],
  learning: [
    'Learning your preferences',
    'Refining your profile',
    'Adapting to your workflow',
    'Updating your memory graph',
  ],
  ready: [
    'Ready for your next command',
    'Awaiting your instruction, Sir',
    'All systems nominal',
    'Standing by',
  ],
}

export function presenceFor(mode: PresenceMode, salt = 0): string {
  const list = PRESENCE[mode]
  return list[Math.abs(Math.floor(salt)) % list.length]
}

export const PRESENCE_MODES: PresenceMode[] = [
  'monitoring',
  'scanning',
  'preparing',
  'summarizing',
  'learning',
  'ready',
]
