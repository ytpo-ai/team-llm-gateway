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
import { useAuthStore } from '@/features/auth/store'

const fmtNum = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 })

function fmtAmount(value: number): string {
  return `${value < 0 ? '-' : ''}${fmtNum.format(Math.abs(value))}`
}

function fmtDate(value?: string): string {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

const TYPE_LABEL: Record<QuotaTransactionType, string> = {
  recharge: '充值',
  adjustment: '调整',
  deduction: '扣减',
}

function TransactionTable({ items }: { items: QuotaTransaction[] }) {
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
        {items.map((item) => (
          <tr key={item.id} className="border-b last:border-0">
            <td className="py-2 pr-4">{TYPE_LABEL[item.type]}</td>
            <td className="py-2 pr-4">{item.source}</td>
            <td
              className={`py-2 pr-4 text-right ${
                item.amount < 0 ? 'text-destructive' : 'text-green-600'
              }`}
            >
              {fmtAmount(item.amount)}
            </td>
            <td className="py-2 pr-4 text-right">{fmtNum.format(item.balanceAfter)}</td>
            <td className="py-2 pr-4">
              {item.description ?? (item.shortfall ? '余额不足（截断）' : '—')}
            </td>
            <td className="py-2 text-right">{fmtDate(item.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

interface TopupFormState {
  mode: 'recharge' | 'adjust'
  amount: string
  target: string
  description: string
}

const emptyForm: TopupFormState = {
  mode: 'recharge',
  amount: '',
  target: '',
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

  const canManage = user?.role === 'team_admin' || user?.role === 'system'

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
  const teamAccount = accounts.find((a) => a.type === 'team')
  const memberAccounts = accounts.filter((a) => a.type === 'member')

  const openTopup = () => {
    setForm(emptyForm)
    setError(null)
    setTopupOpen(true)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setError(null)
    const amount = Number.parseFloat(form.amount)
    if (!Number.isFinite(amount) || amount === 0) {
      setError('请输入非零金额')
      return
    }
    const payload = {
      amount,
      userId: form.target || undefined,
      description: form.description || undefined,
    }
    if (form.mode === 'recharge') {
      if (amount <= 0) {
        setError('充值金额必须大于 0')
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
        <Card>
          <CardHeader>
            <CardDescription>团队额度余额</CardDescription>
            <CardTitle className="text-2xl">
              {accountsQuery.isLoading
                ? '…'
                : fmtNum.format(teamAccount?.balance ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        {memberAccounts.map((account) => (
          <Card key={account.id}>
            <CardHeader>
              <CardDescription>成员额度 · {account.label ?? account.userId}</CardDescription>
              <CardTitle className="text-2xl">{fmtNum.format(account.balance)}</CardTitle>
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
            <TransactionTable items={transactionsQuery.data ?? []} />
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
                    <SelectItem value="">团队账户</SelectItem>
                    {memberAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.userId ?? ''}>
                        {a.label ?? a.userId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">
                  金额
                </label>
                <Input
                  type="number"
                  step="any"
                  placeholder="金额"
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
