import type { Notification } from '@/types'

export const NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    title: 'New top-match role',
    body: 'Nova Systems — Staff Platform Engineer (94% match)',
    time: Date.now() - 1000 * 60 * 32,
    read: false,
    kind: 'career',
  },
  {
    id: 'n2',
    title: 'Calendar optimized',
    body: 'Created a 3-hour focus block for Portfolio Website',
    time: Date.now() - 1000 * 60 * 75,
    read: false,
    kind: 'schedule',
  },
  {
    id: 'n3',
    title: 'New intelligence',
    body: 'HNSW variants reach 4x faster graph construction',
    time: Date.now() - 1000 * 60 * 120,
    read: true,
    kind: 'intelligence',
  },
  {
    id: 'n4',
    title: 'Deadline today',
    body: 'Vector Search design doc — 17:00',
    time: Date.now() - 1000 * 60 * 180,
    read: true,
    kind: 'reminder',
  },
  {
    id: 'n5',
    title: 'System nominal',
    body: 'All health checks passing. Engine load 27%.',
    time: Date.now() - 1000 * 60 * 240,
    read: true,
    kind: 'system',
  },
]
