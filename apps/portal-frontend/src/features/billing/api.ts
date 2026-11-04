import { request } from '@/lib/http'
import type {
  AdjustInput,
  QuotaAccount,
  QuotaAccountType,
  QuotaTransactionPage,
  QuotaTransactionType,
  RechargeInput,
} from './types'

export function listQuotaAccounts(): Promise<QuotaAccount[]> {
  return request<QuotaAccount[]>('/billing/accounts')
}

export function listQuotaTransactions(options: {
  type?: QuotaTransactionType
  accountType?: QuotaAccountType
  userId?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
} = {}): Promise<QuotaTransactionPage> {
  const search = new URLSearchParams()
  if (options.type) search.set('type', options.type)
  if (options.accountType) search.set('accountType', options.accountType)
  if (options.userId) search.set('userId', options.userId)
  if (options.from) search.set('from', options.from)
  if (options.to) search.set('to', options.to)
  search.set('limit', String(options.limit ?? 20))
  search.set('offset', String(options.offset ?? 0))
  return request<QuotaTransactionPage>(
    `/billing/transactions?${search.toString()}`,
  )
}

export function rechargeQuota(input: RechargeInput): Promise<QuotaAccount> {
  return request<QuotaAccount>('/billing/recharge', {
    method: 'POST',
    body: input,
  })
}

export function adjustQuota(input: AdjustInput): Promise<QuotaAccount> {
  return request<QuotaAccount>('/billing/adjust', {
    method: 'POST',
    body: input,
  })
}
