export interface ApiErrorBody {
  type: string
  title: string
  status: number
  code: string
  detail?: unknown
}

export class ApiError extends Error {
  status: number
  code: string
  title: string
  detail?: unknown

  constructor(body: ApiErrorBody) {
    super(body.code)
    this.name = 'ApiError'
    this.status = body.status
    this.code = body.code
    this.title = body.title
    this.detail = body.detail
  }
}

export interface SystemBatteryMetrics {
  percent: number | null
  charging: boolean | null
  present: boolean
}

export interface SystemNetworkMetrics {
  connected: boolean
  type: string
  down_mbps: number
  up_mbps: number
  latency_ms: number | null
  ssid: string | null
}

/** Mirror of backend/app/schemas/system.py::SystemMetrics */
export interface SystemMetrics {
  cpu_percent: number
  cpu_count: number
  ram_percent: number
  ram_used_gb: number
  ram_total_gb: number
  storage_percent: number
  storage_used_gb: number
  storage_total_gb: number
  battery: SystemBatteryMetrics
  gpu: { name?: string; percent?: number } | null
  temp: { c?: number } | null
  network: SystemNetworkMetrics
  api_latency_ms: number | null
  collected_at: string
}