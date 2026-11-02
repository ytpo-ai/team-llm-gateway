import { request } from '@/lib/http'
import type {
  UsageBreakdownItem,
  UsageLogPage,
  UsageLogQuery,
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

export function getUsageLogs(query: UsageLogQuery): Promise<UsageLogPage> {
  const search = new URLSearchParams()
  if (query.page) search.set('page', String(query.page))
  if (query.pageSize) search.set('pageSize', String(query.pageSize))
  if (query.from) search.set('from', query.from)
  if (query.to) search.set('to', query.to)
  if (query.userId) search.set('userId', query.userId)
  if (query.apiKeyId) search.set('apiKeyId', query.apiKeyId)
  if (query.modelId) search.set('modelId', query.modelId)
  if (query.status) search.set('status', query.status)
  const qs = search.toString()
  return request<UsageLogPage>(`/usage/logs${qs ? `?${qs}` : ''}`)
}
