import { ApiError, type ApiErrorBody } from '@/types/api'

export { ApiError }
export type { ApiErrorBody }

export const API_BASE = import.meta.env.VITE_API_URL ?? ''

interface RequestOpts {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  retries?: number
}

interface OkEnvelope<T> {
  success: true
  data: T
}
interface ErrEnvelope {
  success: false
  error: ApiErrorBody
}

const REQUEST_TIMEOUT_MS = 8000
const RETRY_MAX_MS = 2000

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer)
          resolve()
        },
        { once: true },
      )
    }
  })

function combineTimeout(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  if (!signal) return timeout
  if ('any' in AbortSignal) return AbortSignal.any([signal, timeout])
  return signal
}

async function unwrap<T>(res: Response): Promise<T> {
  let json: OkEnvelope<T> | ErrEnvelope
  try {
    json = (await res.json()) as OkEnvelope<T> | ErrEnvelope
  } catch {
    throw new ApiError({
      type: 'http_error',
      title: res.statusText,
      status: res.status,
      code: 'http_error',
    })
  }
  if (json.success) return json.data
  throw new ApiError(json.error)
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { method = 'GET', body, signal, retries = 3 } = opts
  const url = `${API_BASE}/api/v1${path}`
  const inner = combineTimeout(signal)

  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers:
          body !== undefined
            ? { 'content-type': 'application/json' }
            : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: inner,
      })
      return await unwrap<T>(res)
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) throw err
      if (attempt >= retries - 1) throw err
      await sleep(Math.min(RETRY_MAX_MS, 250 * 2 ** attempt), signal)
    }
  }
}

export const api = {
  get: <T>(path: string, opts?: RequestOpts) =>
    request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: RequestOpts) =>
    request<T>(path, { ...opts, body, method: 'POST' }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOpts) =>
    request<T>(path, { ...opts, body, method: 'PATCH' }),
  put: <T>(path: string, body?: unknown, opts?: RequestOpts) =>
    request<T>(path, { ...opts, body, method: 'PUT' }),
  del: <T>(path: string, opts?: RequestOpts) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
}