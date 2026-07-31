import type { ScheduleEntry, UpcomingEvent, WeatherSummary } from '@/types'

export const TODAY: ScheduleEntry[] = [
  {
    id: 's1',
    time: '07:45',
    durationMin: 10,
    title: 'Daily briefing',
    detail: 'STARC morning overview',
    type: 'reminder',
    done: true,
  },
  {
    id: 's2',
    time: '09:00',
    durationMin: 180,
    title: 'Deep focus — Portfolio Website',
    detail: 'Notifications muted · 72% complete',
    type: 'focus',
    done: false,
    important: true,
  },
  {
    id: 's3',
    time: '13:00',
    durationMin: 30,
    title: 'Standup',
    detail: 'Platform team',
    type: 'meeting',
    done: false,
  },
  {
    id: 's4',
    time: '15:00',
    durationMin: 45,
    title: 'Design review',
    detail: 'Vector search API v2',
    type: 'meeting',
    done: false,
  },
  {
    id: 's5',
    time: '16:30',
    durationMin: 60,
    title: 'Resume batch — apply top 4',
    detail: 'STARC prepared drafts',
    type: 'task',
    done: false,
  },
  {
    id: 's6',
    time: '17:00',
    durationMin: 0,
    title: 'Deadline — design doc',
    detail: 'Vector Search design doc',
    type: 'deadline',
    done: false,
    important: true,
  },
]

export const UPCOMING: UpcomingEvent[] = [
  { id: 'u1', day: 'Tomorrow', date: 'Aug 2', title: 'Interview — Nova Systems', time: '10:30', kind: 'interview' },
  { id: 'u2', day: 'Tue', date: 'Aug 4', title: 'Portfolio v2 launch review', time: '11:00', kind: 'meeting' },
  { id: 'u3', day: 'Thu', date: 'Aug 6', title: 'Resume refresh — Q3', time: '16:00', kind: 'deadline' },
  { id: 'u4', day: 'Fri', date: 'Aug 7', title: 'Team offsite', time: 'All day', kind: 'social' },
]

export const WEATHER: WeatherSummary = {
  condition: 'Partly Cloudy',
  tempC: 18,
  tempF: 64,
  chanceRain: 12,
  wind: '14 km/h',
  favorable: true,
  city: 'San Francisco',
}
