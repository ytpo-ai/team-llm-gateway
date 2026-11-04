export type TenantStatus = 'active' | 'suspended'

export interface Tenant {
  id: string
  code: string
  name: string
  status: TenantStatus
  teamCount: number
  memberCount: number
  apiKeyCount: number
  createdAt?: string
}

export interface TenantPage {
  items: Tenant[]
  total: number
  limit: number
  offset: number
}

export interface AdminTeam {
  id: string
  name: string
  tenantId: string
  status: string
}

export interface AdminOverview {
  from: string
  to: string
  tenantCount: number
  teamCount: number
  memberCount: number
  apiKeyCount: number
  requestCount: number
  totalTokens: number
  totalCost: number
}

export interface TenantUsageItem {
  tenantId: string
  name: string
  requestCount: number
  totalTokens: number
  totalCost: number
}

export interface TenantUsageBreakdown {
  from: string
  to: string
  items: TenantUsageItem[]
}
