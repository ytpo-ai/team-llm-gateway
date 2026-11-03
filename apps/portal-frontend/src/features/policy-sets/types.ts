export type PolicyMeasure = 'token' | 'request' | 'concurrency' | 'spend'
export type PolicyWindow =
  | 'permanent'
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
export type PolicyAction = 'block' | 'warn'

export interface PolicyEntry {
  measure: PolicyMeasure
  window: PolicyWindow
  limit: number
  action: PolicyAction
}

export interface PolicySet {
  id: string
  name: string
  description: string
  entries: PolicyEntry[]
  providerIds: string[]
  modelWhitelist: string[]
  builtIn: boolean
  createdAt?: string
}

export interface CreatePolicySetInput {
  name: string
  description?: string
  entries?: PolicyEntry[]
  providerIds?: string[]
  modelWhitelist?: string[]
}

export type UpdatePolicySetInput = Partial<CreatePolicySetInput>

export const MEASURE_LABELS: Record<PolicyMeasure, string> = {
  token: 'Token',
  request: '请求',
  concurrency: '并发',
  spend: '消费',
}

export const WINDOW_LABELS: Record<PolicyWindow, string> = {
  permanent: '永久',
  minute: '分钟',
  hour: '小时',
  day: '日',
  week: '周',
  month: '月',
}

export const ACTION_LABELS: Record<PolicyAction, string> = {
  block: '拦截',
  warn: '预警',
}
