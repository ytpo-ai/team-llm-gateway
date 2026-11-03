export type AuditAction =
  | 'create'
  | 'update'
  | 'disable'
  | 'revoke'
  | 'rotate'
  | 'recharge'
  | 'adjust'
  | 'invite'
  | 'invite_revoke'
  | 'member_update'
  | 'member_remove'
  | 'currency_update'

export type AuditResourceType =
  | 'billing'
  | 'api_key'
  | 'model'
  | 'provider'
  | 'team'
  | 'member'
  | 'invitation'
  | 'currency'

export interface SystemSetting {
  key: string
  value: unknown
  updatedBy: string | null
  updatedAt?: string
}

export interface CurrencyRate {
  code: string
  name: string
  pointsPerUnit: number
}

export interface CurrencyConfig {
  displayCurrency: string
  rates: CurrencyRate[]
}

export interface AuditLog {
  id: string
  userId: string
  action: AuditAction
  resourceType: AuditResourceType
  resourceId: string | null
  summary: string | null
  ip: string | null
  createdAt?: string
}

export interface AuditLogPage {
  items: AuditLog[]
  total: number
  limit: number
  offset: number
}
