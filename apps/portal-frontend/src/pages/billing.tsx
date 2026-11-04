import { useQuery } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { listTeams } from '@/features/teams/api'
import type { Team } from '@/features/teams/types'
import { useAuthStore } from '@/features/auth/store'

const fmtNum = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 })

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

export function BillingPage() {
  const user = useAuthStore((s) => s.user)

  const accountsQuery = useQuery({
    queryKey: ['billing', 'accounts'],
    queryFn: listQuotaAccounts,
  })
  const transactionsQuery = useQuery({
    queryKey: ['billing', 'transactions'],
    queryFn: () => listQuotaTransactions(),
  })
  const currencyQuery = useQuery({
    queryKey: ['system', 'currency'],
    queryFn: getCurrency,
  })
  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: listTeams,
  })

  const isSystem = user?.role === 'system'

  const accounts: QuotaAccount[] = accountsQuery.data ?? []
  const teams: Team[] = teamsQuery.data ?? []
  const teamAccounts = accounts.filter((a) => a.type === 'team')
  const memberAccounts = accounts.filter((a) => a.type === 'member')
  const teamAccount =
    teamAccounts.find((a) => a.teamId === user?.teamId) ?? teamAccounts[0]
  const currencyConfig = currencyQuery.data ?? null
  const teamBalanceMap = new Map(teamAccounts.map((a) => [a.teamId, a]))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">余额与流水</h1>
        <p className="text-sm text-muted-foreground">
          团队 / 成员两级额度账户余额与流水（只读展示）
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground">
            团队余额
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {isSystem ? (
              teams.map((team) => {
                const balance = teamBalanceMap.get(team.id)?.balance ?? 0
                return (
                  <Card key={team.id}>
                    <CardHeader>
                      <CardDescription>{team.name} · 团队额度余额</CardDescription>
                      <CardTitle className="text-2xl">
                        {accountsQuery.isLoading ? '…' : fmtNum.format(balance)}
                      </CardTitle>
                      {formatCurrencyAmount(balance, currencyConfig) && (
                        <p className="text-sm text-muted-foreground">
                          ≈ {formatCurrencyAmount(balance, currencyConfig)}
                        </p>
                      )}
                    </CardHeader>
                  </Card>
                )
              })
            ) : (
              <Card>
                <CardHeader>
                  <CardDescription>团队额度余额</CardDescription>
                  <CardTitle className="text-2xl">
                    {accountsQuery.isLoading
                      ? '…'
                      : fmtNum.format(teamAccount?.balance ?? 0)}
                  </CardTitle>
                  {teamAccount &&
                    formatCurrencyAmount(teamAccount.balance, currencyConfig) && (
                      <p className="text-sm text-muted-foreground">
                        ≈ {formatCurrencyAmount(teamAccount.balance, currencyConfig)}
                      </p>
                    )}
                </CardHeader>
              </Card>
            )}
          </div>
        </div>
        {memberAccounts.length > 0 && (
          <div>
            <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground">
              成员余额
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {memberAccounts.map((account) => (
                <Card key={account.id}>
                  <CardHeader>
                    <CardDescription>
                      成员额度 · {account.label ?? account.userId}
                      {isSystem && account.teamName ? ` · ${account.teamName}` : ''}
                    </CardDescription>
                    <CardTitle className="text-2xl">
                      {fmtNum.format(account.balance)}
                    </CardTitle>
                    {formatCurrencyAmount(account.balance, currencyConfig) && (
                      <p className="text-sm text-muted-foreground">
                        ≈ {formatCurrencyAmount(account.balance, currencyConfig)}
                      </p>
                    )}
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>额度流水</CardTitle>
          <CardDescription>最近 100 条额度变动记录</CardDescription>
        </CardHeader>
        <CardContent>
          {transactionsQuery.isLoading ? (
            <div className="py-6 text-sm text-muted-foreground">加载中…</div>
          ) : (
            <TransactionTable
              items={transactionsQuery.data ?? []}
              config={currencyConfig}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
