import type { MemoryState } from '@/types'

export function seedMemory(): MemoryState {
  return {
    projects: [
      {
        id: 'p1',
        name: 'Portfolio Website',
        description: 'Personal site with case studies and an interactive resume.',
        status: 'active',
        progress: 0.72,
        updatedAt: 'Today',
      },
      {
        id: 'p2',
        name: 'Vector Search Engine',
        description: 'HNSW-backed similarity search for the research index.',
        status: 'active',
        progress: 0.48,
        updatedAt: 'Yesterday',
      },
      {
        id: 'p3',
        name: 'Open Source CLI',
        description: 'CLI tool for scheduling and daily briefings.',
        status: 'paused',
        progress: 0.3,
        updatedAt: '3 days ago',
      },
    ],
    goals: [
      {
        id: 'g1',
        title: 'Land a senior platform role',
        target: '3 interviews scheduled',
        progress: 0.6,
        deadline: 'Q3',
      },
      {
        id: 'g2',
        title: 'Ship portfolio v2',
        target: 'Launch this month',
        progress: 0.72,
        deadline: 'Aug 28',
      },
      {
        id: 'g3',
        title: 'Deepen CUDA knowledge',
        target: '2 more kernels shipped',
        progress: 0.35,
        deadline: 'Sep 15',
      },
    ],
    preferences: [
      { id: 'pref1', key: 'Communication', value: 'Concise, data-driven summaries' },
      { id: 'pref2', key: 'Work hours', value: 'Deep focus 09:00–12:00' },
      { id: 'pref3', key: 'Job search', value: 'Remote-first, visa sponsorship required' },
      { id: 'pref4', key: 'Briefing time', value: 'Daily at 07:45' },
    ],
    pinned: [
      {
        id: 'pin1',
        label: 'Interview Prep',
        snippet: 'Tomorrow 10:30 — Senior Platform Engineer @ Nova Systems',
        kind: 'career',
      },
      {
        id: 'pin2',
        label: 'Resume v7',
        snippet: 'Latest tailored resume with 91% CUDA match',
        kind: 'document',
      },
      {
        id: 'pin3',
        label: 'Focus Protocol',
        snippet: 'Notifications suppressed during 09:00–12:00 focus blocks',
        kind: 'preference',
      },
    ],
    facts: [
      { id: 'f1', text: 'Prefers remote-first roles with visa sponsorship', category: 'career', at: '2d ago' },
      { id: 'f2', text: 'Morning run between 07:00 and 07:40', category: 'personal', at: '5d ago' },
      { id: 'f3', text: 'Shipping portfolio v2 by end of August', category: 'work', at: '1w ago' },
      { id: 'f4', text: 'Favorite stack: TypeScript, Rust, CUDA', category: 'preference', at: '1w ago' },
    ],
    timeline: [
      { id: 't1', at: 'Today 07:45', text: 'Prepared morning briefing with 18 new opportunities', kind: 'action' },
      { id: 't2', at: 'Today 07:10', text: 'Optimized calendar — created a 3h focus block', kind: 'action' },
      { id: 't3', at: 'Yesterday 22:14', text: 'Learned: prefers summaries before full articles', kind: 'learning' },
      { id: 't4', at: 'Yesterday 18:02', text: 'Tailored resume for NVIDIA CUDA role', kind: 'action' },
      { id: 't5', at: 'Mon 09:12', text: 'Saved 6 jobs to review this week', kind: 'preference' },
    ],
  }
}

export const MEMORY_STORAGE_KEY = 'starc.memory.v1'
