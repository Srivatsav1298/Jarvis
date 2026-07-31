import type { Briefing } from '@/types'
import { fullDate, greeting } from '@/utils/format'

export function buildBriefing(date = new Date()): Briefing {
  return {
    salutation: greeting(date),
    timeOfDay: fullDate(date),
    dateLine: 'STARC has been working since 06:02 · 07:45 AM',
    items: [
      { id: 'b1', icon: 'briefcase', text: '18 new job opportunities found', done: true, time: '07:41' },
      { id: 'b2', icon: 'email', text: '3 important emails surfaced', done: true, time: '07:38' },
      { id: 'b3', icon: 'calendar', text: "Tomorrow's interview confirmed", done: true, time: '07:22' },
      { id: 'b4', icon: 'cloud', text: 'Weather looks favorable', done: true, time: '07:15' },
      { id: 'b5', icon: 'sparkles', text: 'Calendar optimized — focus block created', done: true, time: '07:10' },
      { id: 'b6', icon: 'clock', text: 'One deadline today: design doc at 17:00', done: true, time: '06:58' },
    ],
    focus: {
      id: 'focus1',
      title: 'Complete Portfolio Website',
      category: 'Work',
      priority: 'high',
      eta: '~2h 20m',
      progress: 0.72,
    },
    productivity: 0.93,
    primaryAction: 'Continue',
  }
}
