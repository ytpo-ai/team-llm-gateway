import { request } from '@/lib/http'
import type {
  AdjustInput,
  QuotaAccount,
  QuotaTransaction,
  QuotaTransactionType,
  RechargeInput,
} from './types'

export function listQuotaAccounts(): Promise<QuotaAccount[]> {
  return request<QuotaAccount[]>('/billing/accounts')
}

export function listQuotaTransactions(options: {
  type?: QuotaTransactionType
} = {}): Promise<QuotaTransaction[]> {
  const search = new URLSearchParams()
  if (options.type) search.set('type', options.type)
  const qs = search.toString()
  return request<QuotaTransaction[]>(`/billing/transactions${qs ? `?${qs}` : ''}`)
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
