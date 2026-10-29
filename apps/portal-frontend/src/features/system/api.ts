import { request } from '@/lib/http'
import type {
  AuditAction,
  AuditLogPage,
  AuditResourceType,
  SystemSetting,
} from './types'

export function listSettings(): Promise<SystemSetting[]> {
  return request<SystemSetting[]>('/system/settings')
}

export function updateSettings(
  settings: Record<string, unknown>,
): Promise<SystemSetting[]> {
  return request<SystemSetting[]>('/system/settings', {
    method: 'PUT',
    body: { settings },
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
