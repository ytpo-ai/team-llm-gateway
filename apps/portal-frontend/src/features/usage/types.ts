export type UsageGranularity = 'hour' | 'day'

export interface UsageQuery {
  from?: string
  to?: string
  granularity?: UsageGranularity
}

export interface UsageSummary {
  from: string
  to: string
  requestCount: number
  totalTokens: number
  promptTokens: number
  completionTokens: number
  totalCost: number
}

export interface UsageTrendPoint {
  bucket: string
  requestCount: number
  totalTokens: number
  totalCost: number
}

export interface UsageBreakdownItem {
  id: string
  label: string | null
  requestCount: number
  totalTokens: number
  totalCost: number
}

export type UsageLogStatus = 'success' | 'error'

export interface UsageLog {
  id: string
  userId: string
  apiKeyId: string
  providerId: string
  modelId: string
  requestId: string
  status: UsageLogStatus
  promptTokens: number
  completionTokens: number
  totalTokens: number
  multiplier: number
  cost: number
  latencyMs: number | null
  createdAt?: string
}

export interface UsageLogPage {
  items: UsageLog[]
  total: number
  page: number
  pageSize: number
}

export interface UsageLogQuery {
  page?: number
  pageSize?: number
  from?: string
  to?: string
  userId?: string
  apiKeyId?: string
  modelId?: string
  status?: UsageLogStatus
}
