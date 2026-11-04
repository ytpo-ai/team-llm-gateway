import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  listQuotaAccounts,
  listQuotaTransactions,
} from '@/features/billing/api'
import type {
  QuotaAccount,
  QuotaTransaction,
  QuotaTransactionType,
} from '@/features/billing/types'
import { getCurrency } from '@/features/system/api'
import type { CurrencyConfig } from '@/features/system/types'
import { useAuthStore } from '@/features/auth/store'

const fmtNum = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 })

const PAGE_SIZE = 20

function fmtAmount(value: number): string {
  return `${value < 0 ? '-' : ''}${fmtNum.format(Math.abs(value))}`
}

function fmtDate(value?: string): string {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

function formatCurrencyAmount(
  points: number,
  config: CurrencyConfig | null | undefined,
): string | null {
  if (!config) return null
  const rate = config.rates.find((r) => r.code === config.displayCurrency)
  if (!rate || !(rate.pointsPerUnit > 0)) return null
  const amount = points / rate.pointsPerUnit
  try {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: config.displayCurrency,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${fmtNum.format(amount)} ${config.displayCurrency}`
  }
}

const TYPE_LABEL: Record<QuotaTransactionType, string> = {
  recharge: '充值',
  adjustment: '调整',
  deduction: '扣减',
}

function TransactionTable({
  items,
  config,
}: {
  items: QuotaTransaction[]
  config?: CurrencyConfig | null
}) {
  if (items.length === 0) {
    return <div className="py-6 text-sm text-muted-foreground">暂无流水</div>
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-2 pr-4 font-medium">账户</th>
          <th className="py-2 pr-4 font-medium">类型</th>
          <th className="py-2 pr-4 font-medium">来源</th>
          <th className="py-2 pr-4 text-right font-medium">金额</th>
          <th className="py-2 pr-4 text-right font-medium">余额</th>
          <th className="py-2 pr-4 font-medium">备注</th>
          <th className="py-2 text-right font-medium">时间</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const amountCurrency = formatCurrencyAmount(item.amount, config)
          const balanceCurrency = formatCurrencyAmount(item.balanceAfter, config)
          const accountLabel =
            item.accountType === 'member'
              ? `成员 · ${item.label ?? item.userId ?? '—'}`
              : `团队 · ${item.teamName ?? '—'}`
          return (
            <tr key={item.id} className="border-b last:border-0">
              <td className="py-2 pr-4">{accountLabel}</td>
              <td className="py-2 pr-4">{TYPE_LABEL[item.type]}</td>
              <td className="py-2 pr-4">{item.source}</td>
              <td
                className={`py-2 pr-4 text-right ${
                  item.amount < 0 ? 'text-destructive' : 'text-green-600'
                }`}
              >
                {fmtAmount(item.amount)}
                {item.totalTokens != null && item.totalTokens > 0 && (
                  <span className="block text-xs text-muted-foreground">
                    {fmtNum.format(item.totalTokens)} Token
                  </span>
                )}
                {amountCurrency && (
                  <span className="block text-xs text-muted-foreground">
                    {amountCurrency}
                  </span>
                )}
              </td>
              <td className="py-2 pr-4 text-right">
                {fmtNum.format(item.balanceAfter)}
                {balanceCurrency && (
                  <span className="block text-xs text-muted-foreground">
                    {balanceCurrency}
                  </span>
                )}
              </td>
              <td className="py-2 pr-4">
                {item.description ??
                  (item.shortfall ? '余额不足（截断）' : '—')}
              </td>
              <td className="py-2 text-right">{fmtDate(item.createdAt)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

interface BalanceCard {
  key: string
  description: string
  balance: number
}

export function BillingPage() {
  const user = useAuthStore((s) => s.user)
  // 筛选：'all' | 'team' | 成员 userId
  const [filter, setFilter] = useState<string>('all')
  const [offset, setOffset] = useState(0)

  const accountsQuery = useQuery({
    queryKey: ['billing', 'accounts'],
    queryFn: listQuotaAccounts,
  })
  const currencyQuery = useQuery({
    queryKey: ['system', 'currency'],
    queryFn: () => getCurrency(),
  })

  const isSystem = user?.role === 'system'

  const accounts: QuotaAccount[] = accountsQuery.data ?? []
  const teamAccounts = accounts.filter((a) => a.type === 'team')
  const memberAccounts = accounts.filter((a) => a.type === 'member')
  const currencyConfig = currencyQuery.data ?? null

  const txAccountType =
    filter === 'team' ? 'team' : filter === 'all' ? undefined : 'member'
  const txUserId =
    filter === 'all' || filter === 'team' ? undefined : filter

  const transactionsQuery = useQuery({
    queryKey: ['billing', 'transactions', txAccountType, txUserId, offset],
    queryFn: () =>
      listQuotaTransactions({
        accountType: txAccountType,
        userId: txUserId,
        limit: PAGE_SIZE,
        offset,
      }),
    placeholderData: keepPreviousData,
  })

  const txData = transactionsQuery.data
  const txItems = txData?.items ?? []
  const total = txData?.total ?? 0
  const hasPrev = offset > 0
  const hasNext = offset + PAGE_SIZE < total

  // 余额卡片：团队 + 成员统一为一个 3 列网格，按筛选范围展示
  const teamCards: BalanceCard[] = teamAccounts.map((account) => ({
    key: `team-${account.id}`,
    description: account.teamName
      ? `${account.teamName} · 团队额度余额`
      : '团队额度余额',
    balance: account.balance,
  }))

  const visibleMemberAccounts =
    filter === 'all'
      ? memberAccounts
      : filter === 'team'
        ? []
        : memberAccounts.filter((a) => a.userId === filter)

  const visibleCards: BalanceCard[] = [
    ...(filter === 'all' || filter === 'team' ? teamCards : []),
    ...visibleMemberAccounts.map((account) => ({
      key: account.id,
      description: `成员额度 · ${account.label ?? account.userId}${
        isSystem && account.teamName ? ` · ${account.teamName}` : ''
      }`,
      balance: account.balance,
    })),
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">余额与流水</h1>
        <p className="text-sm text-muted-foreground">
          团队 / 成员两级额度账户余额与流水（只读展示）
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={filter}
          onValueChange={(v) => {
            setFilter(v)
            setOffset(0)
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全员</SelectItem>
            <SelectItem value="team">只看团队</SelectItem>
            {memberAccounts.length > 0 && (
              <SelectGroup>
                <SelectLabel>成员</SelectLabel>
                {memberAccounts.map((account) => (
                  <SelectItem
                    key={account.id}
                    value={account.userId ?? account.id}
                  >
                    {account.label ?? account.userId}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
      </div>

      {accountsQuery.isLoading ? (
        <div className="py-6 text-sm text-muted-foreground">加载中…</div>
      ) : visibleCards.length === 0 ? (
        <div className="py-6 text-sm text-muted-foreground">暂无余额数据</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {visibleCards.map((card) => (
            <Card key={card.key}>
              <CardHeader>
                <CardDescription>{card.description}</CardDescription>
                <CardTitle className="text-2xl">
                  {fmtNum.format(card.balance)}
                </CardTitle>
                {formatCurrencyAmount(card.balance, currencyConfig) && (
                  <p className="text-sm text-muted-foreground">
                    ≈ {formatCurrencyAmount(card.balance, currencyConfig)}
                  </p>
                )}
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>额度流水</CardTitle>
          <CardDescription>共 {total} 条</CardDescription>
        </CardHeader>
        <CardContent>
          {transactionsQuery.isLoading ? (
            <div className="py-6 text-sm text-muted-foreground">加载中…</div>
          ) : (
            <TransactionTable items={txItems} config={currencyConfig} />
          )}

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              第 {Math.floor(offset / PAGE_SIZE) + 1} 页
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!hasPrev}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNext}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
              >
                下一页
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
