export type ViewId =
  | 'overview'
  | 'assistant'
  | 'workspace'
  | 'career'
  | 'intelligence'
  | 'automation'
  | 'memory'
  | 'system'
  | 'settings'

export type OrbMode =
  | 'idle'
  | 'monitoring'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'processing'
  | 'completed'

export type PresenceMode =
  | 'monitoring'
  | 'scanning'
  | 'preparing'
  | 'summarizing'
  | 'learning'
  | 'ready'

export interface Toast {
  id: string
  title: string
  message?: string
  tone: 'info' | 'success' | 'warning' | 'error'
  createdAt: number
}

export interface Notification {
  id: string
  title: string
  body: string
  time: number
  read: boolean
  kind: 'intelligence' | 'career' | 'schedule' | 'system' | 'reminder'
}

/* ---------- Metrics ---------- */

export type MetricKey = 'cpu' | 'ram' | 'gpu' | 'temp' | 'latency' | 'netDown'

export interface SensorState {
  active: boolean
  level: number
}

export interface NetworkState {
  connected: boolean
  type: 'wifi' | 'ethernet' | 'cellular'
  downMbps: number
  upMbps: number
  latencyMs: number
  ssid: string
}

export interface Metrics {
  cpu: number
  ram: number
  gpu: number
  battery: number
  batteryCharging: boolean
  storageUsed: number
  storageTotal: number
  temperature: number
  network: NetworkState
  mic: SensorState
  camera: SensorState
  location: {
    active: boolean
    city: string
    lat: number
    lng: number
  }
  history: Record<MetricKey, number[]>
  engine: {
    model: string
    temp: number
    load: number
    uptime: number
    tokensToday: number
  }
}

/* ---------- Chat ---------- */

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  at: number
  streaming?: boolean
}

export interface Conversation {
  id: string
  title: string
  pinned: boolean
  updatedAt: number
  messages: ChatMessage[]
}

export interface Suggestion {
  id: string
  label: string
  prompt: string
  icon?: string
}

/* ---------- Briefing ---------- */

export interface BriefingItem {
  id: string
  icon: string
  text: string
  done: boolean
  time: string
}

export interface FocusTask {
  id: string
  title: string
  category: string
  priority: 'high' | 'medium' | 'low'
  eta: string
  progress: number
}

export interface Briefing {
  salutation: string
  timeOfDay: string
  dateLine: string
  items: BriefingItem[]
  focus: FocusTask
  productivity: number
  primaryAction: string
}

export type ActivityKind = OrbMode

export interface CurrentActivity {
  headline: string
  detail: string
  progress: number
  eta: string
  updatedAt: number
}

/* ---------- Schedule ---------- */

export type ScheduleEntryType =
  | 'meeting'
  | 'task'
  | 'reminder'
  | 'focus'
  | 'deadline'

export interface ScheduleEntry {
  id: string
  time: string
  durationMin: number
  title: string
  detail?: string
  type: ScheduleEntryType
  done: boolean
  important?: boolean
}

export interface UpcomingEvent {
  id: string
  day: string
  date: string
  title: string
  time: string
  kind: 'interview' | 'meeting' | 'deadline' | 'social'
}

export interface WeatherSummary {
  condition: string
  tempC: number
  tempF: number
  chanceRain: number
  wind: string
  favorable: boolean
  city: string
}

/* ---------- Career ---------- */

export type JobStatus = 'saved' | 'applied' | 'interview' | 'offer' | 'new'

export interface Job {
  id: string
  company: string
  role: string
  location: string
  remote: 'onsite' | 'hybrid' | 'remote'
  salary: { min: number; max: number; currency: string }
  visaSponsor: boolean
  match: number
  interviewProbability: number
  growthPotential: number
  competition: number
  skills: string[]
  aiSummary: string
  aiRecommendation: 'top' | 'apply' | 'consider' | 'pass'
  expectedSalary: number
  postedDaysAgo: number
  status: JobStatus
  logoHue?: number
}

/* ---------- Intelligence ---------- */

export type NewsCategory =
  | 'AI'
  | 'Programming'
  | 'Technology'
  | 'Research'
  | 'Cybersecurity'
  | 'Finance'
  | 'Career'

export interface Article {
  id: string
  category: NewsCategory
  title: string
  summary: string
  source: string
  sourceUrl: string
  time: string
  relevance: number
  tags: string[]
}

/* ---------- Automations ---------- */

export type AutomationStatus =
  | 'running'
  | 'paused'
  | 'scheduled'
  | 'error'
  | 'completed'

export interface Automation {
  id: string
  name: string
  description: string
  status: AutomationStatus
  icon: string
  lastRun: string
  nextRun: string
  runs: number
  category: 'career' | 'productivity' | 'intelligence' | 'memory' | 'email'
}

/* ---------- Memory ---------- */

export interface MemoryProject {
  id: string
  name: string
  description: string
  status: 'active' | 'paused' | 'completed'
  progress: number
  updatedAt: string
}

export interface MemoryGoal {
  id: string
  title: string
  target: string
  progress: number
  deadline: string
}

export interface MemoryPreference {
  id: string
  key: string
  value: string
}

export interface PinnedContext {
  id: string
  label: string
  snippet: string
  kind: string
}

export interface Fact {
  id: string
  text: string
  category: 'personal' | 'work' | 'career' | 'preference'
  at: string
}

export interface MemoryTimelineItem {
  id: string
  at: string
  text: string
  kind: string
}

export interface MemoryState {
  projects: MemoryProject[]
  goals: MemoryGoal[]
  preferences: MemoryPreference[]
  pinned: PinnedContext[]
  facts: Fact[]
  timeline: MemoryTimelineItem[]
}
