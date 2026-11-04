export type QuotaAccountType = 'team' | 'member'
export type QuotaAccountStatus = 'active' | 'frozen'
export type QuotaTransactionType = 'recharge' | 'adjustment' | 'deduction'
export type QuotaTransactionSource = 'recharge' | 'manual' | 'usage'

export interface QuotaAccount {
  id: string
  type: QuotaAccountType
  teamId: string
  teamName: string | null
  userId: string | null
  label: string | null
  balance: number
  status: QuotaAccountStatus
  createdAt?: string
}

export interface QuotaTransaction {
  id: string
  accountId: string
  accountType: QuotaAccountType
  userId: string | null
  type: QuotaTransactionType
  source: QuotaTransactionSource
  amount: number
  balanceAfter: number
  shortfall: boolean
  referenceId: string | null
  description: string | null
  createdAt?: string
}

export interface RechargeInput {
  amount: number
  teamId?: string
  userId?: string
  description?: string
}

export interface AdjustInput {
  amount: number
  teamId?: string
  userId?: string
  description?: string
}
