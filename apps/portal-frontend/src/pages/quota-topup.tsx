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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { listAllTeams } from '@/features/admin/api'
import { adjustQuota, rechargeQuota } from '@/features/billing/api'
import { useAuthStore } from '@/features/auth/store'
import { listMembers, listTeams } from '@/features/teams/api'
import type { Member } from '@/features/teams/types'

// 充值单位：百万点数，1 百万点数 = 100 万点
const POINTS_PER_MILLION = 1_000_000

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

export function QuotaTopupPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)

  const [form, setForm] = useState<TopupFormState>(emptyForm)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isSystem = user?.role === 'system'

  const teamsQuery = useQuery({
    queryKey: isSystem ? ['admin', 'teams'] : ['teams'],
    queryFn: () => (isSystem ? listAllTeams() : listTeams()),
  })
  const teams = teamsQuery.data ?? []

  // 缺省团队：优先当前用户所在团队，其次首个团队
  const defaultTeamId =
    teams.find((t) => t.id === user?.teamId)?.id ?? teams[0]?.id ?? user?.teamId ?? ''
  const teamId = form.teamId || defaultTeamId

  const membersQuery = useQuery({
    queryKey: ['team-members', teamId],
    queryFn: () => listMembers(teamId),
    enabled: Boolean(teamId),
  })
  const members: Member[] = membersQuery.data ?? []

  const rechargeMutation = useMutation({
    mutationFn: rechargeQuota,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] })
      setMessage('充值成功')
      setError(null)
      setForm(emptyForm)
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
    },
    onError: (err: Error) => setError(err.message),
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setError(null)
    const millionPoints = Number.parseFloat(form.amount)
    if (!Number.isFinite(millionPoints) || millionPoints === 0) {
      setError('请输入非零额度')
      return
    }
    const amount = Math.round(millionPoints * POINTS_PER_MILLION)
    const payload = {
      amount,
      teamId: teamId || undefined,
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
      <div>
        <h1 className="text-xl font-semibold">额度充值 / 调整</h1>
        <p className="text-sm text-muted-foreground">
          系统操作：对团队或指定成员账户充值 / 调整额度（正加负减）
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>充值 / 调整额度</CardTitle>
          <CardDescription>
            缺省目标为团队账户，可指定成员账户；额度单位为百万点数（1 = 100 万点）
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                    value={teamId}
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
                  额度（百万点数）
                </label>
                <Input
                  type="number"
                  step="any"
                  placeholder="如 1 = 100 万点"
                  value={form.amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amount: e.target.value }))
                  }
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
            <div className="flex items-center gap-3">
              <Button
                type="submit"
                disabled={rechargeMutation.isPending || adjustMutation.isPending}
              >
                提交
              </Button>
              {message && <p className="text-sm text-green-600">{message}</p>}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
