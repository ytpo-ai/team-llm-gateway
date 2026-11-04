import { request } from '@/lib/http'
import type {
  AdminOverview,
  AdminTeam,
  Tenant,
  TenantPage,
  TenantStatus,
  TenantUsageBreakdown,
} from './types'

export function listTenants(
  options: {
    status?: TenantStatus
    search?: string
    limit?: number
    offset?: number
  } = {},
): Promise<TenantPage> {
  const search = new URLSearchParams()
  if (options.status) search.set('status', options.status)
  if (options.search) search.set('search', options.search)
  search.set('limit', String(options.limit ?? 50))
  search.set('offset', String(options.offset ?? 0))
  return request<TenantPage>(`/admin/tenants?${search.toString()}`)
}

export function createTenant(input: {
  code: string
  name: string
}): Promise<Tenant> {
  return request<Tenant>('/admin/tenants', {
    method: 'POST',
    body: input,
  })
}

export function updateTenantStatus(
  id: string,
  status: TenantStatus,
): Promise<Tenant> {
  return request<Tenant>(`/admin/tenants/${id}/status`, {
    method: 'PATCH',
    body: { status },
  })
}

export function getOverview(): Promise<AdminOverview> {
  return request<AdminOverview>('/admin/overview')
}

export function listAllTeams(): Promise<AdminTeam[]> {
  return request<AdminTeam[]>('/admin/teams')
}

export function getUsageBreakdown(): Promise<TenantUsageBreakdown> {
  return request<TenantUsageBreakdown>('/admin/overview/usage')
}
