import { request } from '@/lib/http'
import type {
  UsageBreakdownItem,
  UsageQuery,
  UsageSummary,
  UsageTrendPoint,
} from './types'

function toQuery(params: UsageQuery): string {
  const search = new URLSearchParams()
  if (params.from) search.set('from', params.from)
  if (params.to) search.set('to', params.to)
  if (params.granularity) search.set('granularity', params.granularity)
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

export function getUsageSummary(query: UsageQuery): Promise<UsageSummary> {
  return request<UsageSummary>(`/usage/summary${toQuery(query)}`)
}

export function getUsageTrends(query: UsageQuery): Promise<UsageTrendPoint[]> {
  return request<UsageTrendPoint[]>(`/usage/trends${toQuery(query)}`)
}

export function getUsageByModel(query: UsageQuery): Promise<UsageBreakdownItem[]> {
  return request<UsageBreakdownItem[]>(`/usage/by-model${toQuery(query)}`)
}

export function getUsageByMember(query: UsageQuery): Promise<UsageBreakdownItem[]> {
  return request<UsageBreakdownItem[]>(`/usage/by-member${toQuery(query)}`)
}

export function getUsageByKey(query: UsageQuery): Promise<UsageBreakdownItem[]> {
  return request<UsageBreakdownItem[]>(`/usage/by-key${toQuery(query)}`)
}
