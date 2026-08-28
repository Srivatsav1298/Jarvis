import { api } from '@/services/api'
import type { Job, JobStatus } from '@/types'
import { hash01 } from '@/utils/random'

export function jobLogoHue(company: string): number {
  return Math.round(hash01(company) * 220)
}

interface RawJob {
  id?: string
  company?: string
  role?: string
  location?: string
  source?: string
  sourceUrl?: string
  postedDaysAgo?: number
  fetchedAt?: string
  skills?: unknown
  aiSummary?: string
  aiRecommendation?: string
  match?: number
  salary?: { min?: number; max?: number; currency?: string }
  visaSponsor?: boolean
  remote?: string
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v))
}

function normalizeJob(raw: RawJob): Job {
  const match = clamp(typeof raw.match === 'number' ? raw.match : 60)
  const salary = raw.salary ?? {}
  const min = typeof salary.min === 'number' ? salary.min : 0
  const max = typeof salary.max === 'number' ? salary.max : min
  const skills = Array.isArray(raw.skills)
    ? raw.skills.filter((s): s is string => typeof s === 'string').slice(0, 8)
    : []
  const rec = raw.aiRecommendation ?? (match >= 85 ? 'top' : match >= 70 ? 'apply' : 'consider')
  const status: JobStatus = ['saved', 'applied', 'interview', 'offer', 'new'].includes(
    raw.aiRecommendation ?? '',
  )
    ? (raw.aiRecommendation as JobStatus)
    : 'new'
  return {
    id: typeof raw.id === 'string' ? raw.id : `j-${Math.random().toString(36).slice(2, 8)}`,
    company: raw.company || 'Unknown',
    role: raw.role || 'Role',
    location: raw.location || 'Norway',
    remote: raw.remote === 'remote' ? 'remote' : raw.remote === 'onsite' ? 'onsite' : 'hybrid',
    salary: { min, max, currency: salary.currency ?? 'kr' },
    visaSponsor: raw.visaSponsor === true,
    match,
    interviewProbability: clamp(match - 18),
    growthPotential: clamp(Math.round(match * 0.82)),
    competition: clamp(Math.round((100 - match) / 2.4)),
    skills,
    aiSummary: raw.aiSummary || `Matched for ${raw.role || 'this role'} at ${raw.company || 'this company'}.`,
    aiRecommendation: rec as Job['aiRecommendation'],
    expectedSalary: max > 0 ? Math.round((min + max) / 2) : 0,
    postedDaysAgo: typeof raw.postedDaysAgo === 'number' ? raw.postedDaysAgo : 0,
    fetchedAt: typeof raw.fetchedAt === 'string' ? raw.fetchedAt : undefined,
    source: raw.source || '',
    sourceUrl: raw.sourceUrl || '',
    status,
  }
}

export async function fetchJobs(
  role?: string,
  signal?: AbortSignal,
  fresh = false,
): Promise<Job[]> {
  const params = new URLSearchParams()
  if (role) params.set('role', role)
  params.set('limit', '40')
  if (fresh) params.set('fresh', 'true')
  const raw = await api.get<unknown[]>(
    `/intelligence/jobs${params.size ? `?${params.toString()}` : ''}`,
    { signal, retries: 1 },
  )
  if (!Array.isArray(raw)) throw new Error('unexpected jobs payload')
  return raw
    .filter((j): j is RawJob => typeof j === 'object' && j !== null)
    .map(normalizeJob)
}
