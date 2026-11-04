import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  adjustQuota,
  listQuotaAccounts,
  listQuotaTransactions,
  rechargeQuota,
} from '@/features/billing/api'
import type {
  QuotaAccount,
  QuotaTransaction,
  QuotaTransactionType,
} from '@/features/billing/types'
import { getCurrency } from '@/features/system/api'
import type { CurrencyConfig } from '@/features/system/types'
import { listMembers, listTeams } from '@/features/teams/api'
import type { Member, Team } from '@/features/teams/types'
import { useAuthStore } from '@/features/auth/store'

const fmtNum = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 })

// 1 百万 Token（按基准倍率 1，即 GPT-4o）= 100 万点（cost = multiplier × tokens）
const POINTS_PER_MILLION_TOKENS = 1_000_000

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
          return (
            <tr key={item.id} className="border-b last:border-0">
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

interface TopupFormState {
  mode: 'recharge' | 'adjust'
  amount: string
  teamId: string
  target: string
  description: string
}

const emptyForm: TopupFormState = {
  mode: 'recharge',
  amount: '',
  teamId: '',
  target: 'team',
  description: '',
}

export function BillingPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)

  const [topupOpen, setTopupOpen] = useState(false)
  const [form, setForm] = useState<TopupFormState>(emptyForm)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
  const membersQuery = useQuery({
    queryKey: ['team-members', form.teamId],
    queryFn: () => listMembers(form.teamId),
    enabled: Boolean(form.teamId),
  })

  const canManage = user?.role === 'team_admin' || user?.role === 'system'
  const isSystem = user?.role === 'system'

  const rechargeMutation = useMutation({
    mutationFn: rechargeQuota,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] })
      setMessage('充值成功')
      setError(null)
      setForm(emptyForm)
      setTopupOpen(false)
    },
    onError: (err: Error) => setError(err.message),
  })

  const adjustMutation = useMutation({
    mutationFn: adjustQuota,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] })
      setMessage('调整成功')
      setError(null)
      setForm(emptyForm)
      setTopupOpen(false)
    },
    onError: (err: Error) => setError(err.message),
  })

  const accounts: QuotaAccount[] = accountsQuery.data ?? []
  const teams: Team[] = teamsQuery.data ?? []
  const members: Member[] = membersQuery.data ?? []
  const teamAccounts = accounts.filter((a) => a.type === 'team')
  const memberAccounts = accounts.filter((a) => a.type === 'member')
  const teamAccount =
    teamAccounts.find((a) => a.teamId === user?.teamId) ?? teamAccounts[0]
  const currencyConfig = currencyQuery.data ?? null
  const teamBalanceMap = new Map(teamAccounts.map((a) => [a.teamId, a]))

  const openTopup = () => {
    const defaultTeamId =
      teams.find((t) => t.id === user?.teamId)?.id ??
      teams[0]?.id ??
      user?.teamId ??
      ''
    setForm({ ...emptyForm, teamId: defaultTeamId })
    setError(null)
    setTopupOpen(true)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setError(null)
    const millionTokens = Number.parseFloat(form.amount)
    if (!Number.isFinite(millionTokens) || millionTokens === 0) {
      setError('请输入非零额度')
      return
    }
    const amount = Math.round(millionTokens * POINTS_PER_MILLION_TOKENS)
    const payload = {
      amount,
      teamId: form.teamId || undefined,
      userId: form.target === 'team' ? undefined : form.target,
      description: form.description || undefined,
    }
    if (form.mode === 'recharge') {
      if (amount <= 0) {
        setError('充值额度必须大于 0')
        return
      }
      rechargeMutation.mutate(payload)
    } else {
      adjustMutation.mutate(payload)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">额度与计费</h1>
          <p className="text-sm text-muted-foreground">
            统一扣费引擎（成本 = 模型倍率 × Token），团队 / 成员两级额度账户
          </p>
        </div>
        {canManage && <Button onClick={openTopup}>充值 / 调整额度</Button>}
      </div>

      {message && <p className="text-sm text-green-600">{message}</p>}

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
        {memberAccounts.map((account) => (
          <Card key={account.id}>
            <CardHeader>
              <CardDescription>
                成员额度 · {account.label ?? account.userId}
                {isSystem && account.teamName ? ` · ${account.teamName}` : ''}
              </CardDescription>
              <CardTitle className="text-2xl">{fmtNum.format(account.balance)}</CardTitle>
              {formatCurrencyAmount(account.balance, currencyConfig) && (
                <p className="text-sm text-muted-foreground">
                  ≈ {formatCurrencyAmount(account.balance, currencyConfig)}
                </p>
              )}
            </CardHeader>
          </Card>
        ))}
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

      <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>充值 / 调整额度</DialogTitle>
            <DialogDescription>
              缺省目标为团队账户，可指定成员账户
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">
                  类型
                </label>
                <Select
                  value={form.mode}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      mode: v as TopupFormState['mode'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recharge">充值</SelectItem>
                    <SelectItem value="adjust">调整（正加负减）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isSystem && (
                <div>
                  <label className="mb-1 block text-sm text-muted-foreground">
                    团队
                  </label>
                  <Select
                    value={form.teamId}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, teamId: v, target: 'team' }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">
                  目标账户
                </label>
                <Select
                  value={form.target}
                  onValueChange={(v) => setForm((f) => ({ ...f, target: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="team">团队账户</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">
                  额度（百万 Token）
                </label>
                <Input
                  type="number"
                  step="any"
                  placeholder="如 1 = 100 万 Token"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">
                  备注（可选）
                </label>
                <Input
                  placeholder="备注（可选）"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTopupOpen(false)}>
                取消
              </Button>
              <Button
                type="submit"
                disabled={rechargeMutation.isPending || adjustMutation.isPending}
              >
                提交
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
