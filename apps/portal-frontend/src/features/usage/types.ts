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
