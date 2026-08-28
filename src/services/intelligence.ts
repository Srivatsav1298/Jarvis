import { api } from '@/services/api'
import type { Article, DailyForecast, NewsCategory, Weather } from '@/types'

export const NEWS_CATEGORIES: NewsCategory[] = [
  'Technology',
  'World',
  'Sports',
  'Finance',
  'Trending',
  'Latest',
]

const VALID_CATEGORIES = new Set<NewsCategory>(NEWS_CATEGORIES)

function normalizeArticle(raw: Record<string, unknown>): Article {
  const category = VALID_CATEGORIES.has(raw.category as NewsCategory)
    ? (raw.category as NewsCategory)
    : 'Latest'
  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((t): t is string => typeof t === 'string').slice(0, 5)
    : []
  return {
    id: typeof raw.id === 'string' ? raw.id : `n-${Math.random().toString(36).slice(2, 8)}`,
    category,
    title: typeof raw.title === 'string' ? raw.title : 'Untitled',
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    source: typeof raw.source === 'string' ? raw.source : '',
    sourceUrl: typeof raw.sourceUrl === 'string' ? raw.sourceUrl : '#',
    time: typeof raw.time === 'string' ? raw.time : 'recent',
    relevance: typeof raw.relevance === 'number' ? raw.relevance : 50,
    tags,
  }
}

export async function fetchArticles(
  category: NewsCategory | 'All' = 'All',
  signal?: AbortSignal,
): Promise<Article[]> {
  const params = new URLSearchParams()
  if (category !== 'All') params.set('category', category)
  params.set('limit', '40')
  const raw = await api.get<unknown[]>(
    `/intelligence/news${params.size ? `?${params.toString()}` : ''}`,
    { signal, retries: 1 },
  )
  if (!Array.isArray(raw)) throw new Error('unexpected news payload')
  return raw
    .filter((a): a is Record<string, unknown> => typeof a === 'object' && a !== null)
    .map(normalizeArticle)
}

interface RawForecast {
  date?: string
  condition?: string
  temp_min_c?: number
  temp_max_c?: number
}

interface RawWeather {
  location?: string
  temperature_c?: number
  feels_like_c?: number
  condition?: string
  humidity?: number
  wind_kmh?: number
  updated_at?: string
  daily?: RawForecast[]
}

function normalizeWeather(raw: RawWeather): Weather {
  const daily: DailyForecast[] = Array.isArray(raw.daily)
    ? raw.daily
        .filter((d): d is RawForecast => typeof d === 'object' && d !== null)
        .map((d) => ({
          date: typeof d.date === 'string' ? d.date.slice(5) : '',
          condition: typeof d.condition === 'string' ? d.condition : 'Unknown',
          tempMinC: typeof d.temp_min_c === 'number' ? Math.round(d.temp_min_c) : 0,
          tempMaxC: typeof d.temp_max_c === 'number' ? Math.round(d.temp_max_c) : 0,
        }))
    : []
  return {
    location: typeof raw.location === 'string' ? raw.location : 'Oslo, Norway',
    temperatureC: typeof raw.temperature_c === 'number' ? Math.round(raw.temperature_c) : 0,
    feelsLikeC: typeof raw.feels_like_c === 'number' ? Math.round(raw.feels_like_c) : 0,
    condition: typeof raw.condition === 'string' ? raw.condition : 'Unknown',
    humidity: typeof raw.humidity === 'number' ? raw.humidity : 0,
    windKmh: typeof raw.wind_kmh === 'number' ? Math.round(raw.wind_kmh) : 0,
    updatedAt: typeof raw.updated_at === 'string' ? raw.updated_at : new Date().toISOString(),
    daily,
  }
}

export async function fetchWeather(signal?: AbortSignal): Promise<Weather> {
  const raw = await api.get<Record<string, unknown>>('/intelligence/weather', {
    signal,
    retries: 1,
  })
  return normalizeWeather(raw)
}
