import { request } from '@/lib/http'
import type {
  AuditAction,
  AuditLogPage,
  AuditResourceType,
  CurrencyConfig,
  SystemSetting,
} from './types'

export function listSettings(): Promise<SystemSetting[]> {
  return request<SystemSetting[]>('/system/settings', { tenant: false })
}

export function updateSettings(
  settings: Record<string, unknown>,
): Promise<SystemSetting[]> {
  return request<SystemSetting[]>('/system/settings', {
    method: 'PUT',
    body: { settings },
    tenant: false,
  })
}

export function getCurrency(
  options: { tenant?: boolean } = {},
): Promise<CurrencyConfig | null> {
  return request<CurrencyConfig | null>('/system/currency', {
    tenant: options.tenant,
  })
}

export function updateCurrency(
  config: CurrencyConfig,
  options: { tenant?: boolean } = {},
): Promise<CurrencyConfig> {
  return request<CurrencyConfig>('/system/currency', {
    method: 'PUT',
    body: config,
    tenant: options.tenant,
  })
}

export function listAuditLogs(options: {
  action?: AuditAction
  resourceType?: AuditResourceType
  userId?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
} = {}): Promise<AuditLogPage> {
  const search = new URLSearchParams()
  if (options.action) search.set('action', options.action)
  if (options.resourceType) search.set('resourceType', options.resourceType)
  if (options.userId) search.set('userId', options.userId)
  if (options.from) search.set('from', options.from)
  if (options.to) search.set('to', options.to)
  search.set('limit', String(options.limit ?? 50))
  search.set('offset', String(options.offset ?? 0))
  return request<AuditLogPage>(`/system/audit-logs?${search.toString()}`)
}
