import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  rotateApiKey,
  updateApiKey,
} from '@/features/api-keys/api'
import type {
  ApiKey,
  ApiKeyInput,
  ApiKeyPatch,
  ApiKeyResult,
} from '@/features/api-keys/types'
import { useAuthStore } from '@/features/auth/store'
import { listPolicySets } from '@/features/policy-sets/api'
import type { PolicySet } from '@/features/policy-sets/types'
import { listMembers, listTeams } from '@/features/teams/api'
import type { Member } from '@/features/teams/types'
import { ApiError } from '@/lib/http'

function formatDate(value: string | null): string {
  if (!value) return '永久'
  return new Date(value).toLocaleDateString()
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function formatExpiry(value: string | null): string {
  if (!value) return '永久'
  const d = new Date(value)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function countdownText(value: string | null, now: number): string {
  if (!value) return ''
  const remaining = new Date(value).getTime() - now
  if (remaining <= 0) return '已过期'
  const totalMinutes = Math.floor(remaining / 60000)
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60
  const parts: string[] = []
  if (days > 0) parts.push(`${days}天`)
  if (hours > 0) parts.push(`${hours}小时`)
  if (minutes > 0) parts.push(`${minutes}分钟`)
  return `剩 ${parts.length ? parts.join('') : '<1分钟'}`
}

type ExpiryUnit = 'hour' | 'day' | 'month' | 'never'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

function computeExpiry(value: number, unit: ExpiryUnit): Date {
  const now = new Date()
  if (unit === 'hour') return new Date(now.getTime() + value * HOUR_MS)
  if (unit === 'day') return new Date(now.getTime() + value * DAY_MS)
  const d = new Date(now)
  d.setMonth(d.getMonth() + value)
  return d
}

function resolveExpiry(form: FormState): string | null {
  if (form.expiresUnit === 'never') return null
  const value = Number(form.expiresValue)
  if (!Number.isInteger(value) || value <= 0) return null
  return computeExpiry(value, form.expiresUnit).toISOString()
}

function durationFromExpiry(expiresAt: string | null): {
  expiresValue: string
  expiresUnit: ExpiryUnit
} {
  if (!expiresAt) return { expiresValue: '', expiresUnit: 'never' }
  const remaining = new Date(expiresAt).getTime() - Date.now()
  if (remaining <= 0) return { expiresValue: '1', expiresUnit: 'hour' }
  const days = remaining / DAY_MS
  if (days >= 30) {
    return { expiresValue: String(Math.ceil(days / 30)), expiresUnit: 'month' }
  }
  if (days >= 1) {
    return { expiresValue: String(Math.ceil(days)), expiresUnit: 'day' }
  }
  return {
    expiresValue: String(Math.max(1, Math.ceil(remaining / HOUR_MS))),
    expiresUnit: 'hour',
  }
}

interface FormState {
  userId: string
  name: string
  policySetId: string
  expiresValue: string
  expiresUnit: ExpiryUnit
}

const emptyForm: FormState = {
  userId: '',
  name: '',
  policySetId: '',
  expiresValue: '',
  expiresUnit: 'never',
}

function toForm(key: ApiKey): FormState {
  return {
    userId: key.userId,
    name: key.name ?? '',
    policySetId: key.policySetId ?? '',
    ...durationFromExpiry(key.expiresAt),
  }
}

type KeyAction = { type: 'revoke' | 'rotate'; key: ApiKey } | null

export function ApiKeysPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isTeamAdmin = user?.role === 'team_admin' || user?.role === 'system'

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editing, setEditing] = useState<ApiKey | null>(null)
  const [revealed, setRevealed] = useState<{
    key: string
    name: string | null
  } | null>(null)
  const [action, setAction] = useState<KeyAction>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  const keysQuery = useQuery({ queryKey: ['api-keys'], queryFn: () => listApiKeys() })

  const policySetsQuery = useQuery({
    queryKey: ['policy-sets'],
    queryFn: listPolicySets,
  })

  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: listTeams })
  const teamId = teamsQuery.data?.[0]?.id
  const membersQuery = useQuery({
    queryKey: ['team-members', teamId],
    queryFn: () => listMembers(teamId!),
    enabled: isTeamAdmin && Boolean(teamId),
  })
  const members: Member[] = membersQuery.data ?? []
  const policySets: PolicySet[] = policySetsQuery.data ?? []

  const policySetName = (id: string | null) =>
    policySets.find((s) => s.id === id)?.name ?? '不限'

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['api-keys'] })

  const resetForm = () => {
    setForm(emptyForm)
    setEditing(null)
    setError(null)
  }

  const openCreate = () => {
    resetForm()
    setFormOpen(true)
  }

  const submitMutation = useMutation({
    mutationFn: () => {
      const expiresAt = resolveExpiry(form)
      if (editing) {
        const patch: ApiKeyPatch = {
          userId: form.userId || undefined,
          name: form.name.trim() || null,
          expiresAt,
          policySetId: form.policySetId || null,
        }
        return updateApiKey(editing.id, patch)
      }
      const input: ApiKeyInput = {
        userId: form.userId || undefined,
        name: form.name.trim() || undefined,
        expiresAt: expiresAt ?? undefined,
        policySetId: form.policySetId || undefined,
      }
      return createApiKey(input)
    },
    onSuccess: (result: ApiKey | ApiKeyResult) => {
      resetForm()
      setFormOpen(false)
      invalidate()
      if ('key' in result) {
        setRevealed({ key: result.key, name: result.apiKey.name })
      }
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : '操作失败，请稍后重试')
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: () => {
      invalidate()
      setAction(null)
    },
  })

  const rotateMutation = useMutation({
    mutationFn: (id: string) => rotateApiKey(id),
    onSuccess: (result) => {
      setRevealed({ key: result.key, name: result.apiKey.name })
      setAction(null)
      invalidate()
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (form.expiresUnit !== 'never') {
      const value = Number(form.expiresValue)
      if (!Number.isInteger(value) || value <= 0) {
        setError('请输入有效的限时值（正整数）')
        return
      }
    }
    submitMutation.mutate()
  }

  const startEdit = (key: ApiKey) => {
    setEditing(key)
    setForm(toForm(key))
    setError(null)
    setFormOpen(true)
  }

  const confirmAction = () => {
    if (!action) return
    if (action.type === 'revoke') {
      revokeMutation.mutate(action.key.id)
    } else {
      rotateMutation.mutate(action.key.id)
    }
  }

  const copyKey = async () => {
    if (revealed) {
      await navigator.clipboard.writeText(revealed.key)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  const keys: ApiKey[] = keysQuery.data ?? []
  const hasKeyError = keysQuery.isError && !keysQuery.data
  const pending =
    submitMutation.isPending ||
    revokeMutation.isPending ||
    rotateMutation.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">API Key</h1>
          <p className="text-sm text-muted-foreground">
            为成员签发 API Key，并绑定策略集控制额度与访问范围
          </p>
        </div>
        <Button onClick={openCreate}>创建 API Key</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Key 列表</CardTitle>
        </CardHeader>
        <CardContent>
          {keysQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">加载中…</div>
          ) : hasKeyError ? (
            <div className="space-y-3 py-8 text-center">
              <p className="text-sm text-destructive">
                加载失败：{keysQuery.error instanceof ApiError ? keysQuery.error.message : '请检查网络连接后重试'}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => keysQuery.refetch()}
              >
                重试
              </Button>
            </div>
          ) : keys.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              暂无 API Key，点击右上角创建。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">名称</th>
                    <th className="py-2 pr-4 font-medium">成员</th>
                    <th className="py-2 pr-4 font-medium">Key</th>
                    <th className="py-2 pr-4 font-medium">状态</th>
                    <th className="py-2 pr-4 font-medium">策略集</th>
                    <th className="py-2 pr-4 font-medium">过期</th>
                    <th className="py-2 pr-4 font-medium">最近使用</th>
                    <th className="py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => (
                    <tr key={key.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        {key.name ?? <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {key.userName ?? key.userEmail ?? '—'}
                      </td>
                      <td className="py-2 pr-4">
                        <code className="text-xs">{key.keyPrefix}…</code>
                      </td>
                      <td className="py-2 pr-4">
                        {key.status === 'active' ? (
                          <span className="text-green-600">正常</span>
                        ) : (
                          <span className="text-muted-foreground">已吊销</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {policySetName(key.policySetId)}
                      </td>
                      <td className="py-2 pr-4">
                        {key.status === 'active' ? (
                          <>
                            <div>{formatExpiry(key.expiresAt)}</div>
                            {key.expiresAt && (
                              <div
                                className={`text-xs ${
                                  new Date(key.expiresAt).getTime() <= now
                                    ? 'text-red-500'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                {countdownText(key.expiresAt, now)}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {key.lastUsedAt ? formatDate(key.lastUsedAt) : '—'}
                      </td>
                      <td className="py-2">
                        {key.status === 'active' && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={pending}
                              onClick={() => startEdit(key)}
                            >
                              编辑
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={pending}
                              onClick={() => setAction({ type: 'rotate', key })}
                            >
                              轮换
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={pending}
                              onClick={() => setAction({ type: 'revoke', key })}
                            >
                              吊销
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? '编辑 API Key' : '创建 API Key'}</SheetTitle>
            <SheetDescription>
              {editing
                ? `正在编辑 ${editing.keyPrefix}…`
                : '创建后完整 key 仅展示一次，请及时保存'}
            </SheetDescription>
          </SheetHeader>
          <form
            className="flex flex-1 flex-col gap-4 overflow-y-auto"
            onSubmit={handleSubmit}
          >
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                名称
              </label>
              <Input
                placeholder="如：我的开发密钥（可选）"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            {isTeamAdmin && (
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">
                  绑定成员
                </label>
                <Select
                  value={form.userId || 'self'}
                  onValueChange={(value) =>
                    setForm({ ...form, userId: value === 'self' ? '' : value })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择成员" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">（默认：我自己）</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                        {m.email ? `（${m.email}）` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                绑定策略集
              </label>
              <Select
                value={form.policySetId || ''}
                onValueChange={(v) => setForm({ ...form, policySetId: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="不限" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">不限</SelectItem>
                  {policySets.map((set) => (
                    <SelectItem key={set.id} value={set.id}>
                      {set.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                过期时间
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  placeholder={
                    form.expiresUnit === 'never' ? '永久有效' : '限时值'
                  }
                  value={form.expiresValue}
                  disabled={form.expiresUnit === 'never'}
                  onChange={(e) =>
                    setForm({ ...form, expiresValue: e.target.value })
                  }
                />
                <Select
                  value={form.expiresUnit}
                  onValueChange={(v) =>
                    setForm({ ...form, expiresUnit: v as ExpiryUnit })
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">永久</SelectItem>
                    <SelectItem value="hour">小时</SelectItem>
                    <SelectItem value="day">天</SelectItem>
                    <SelectItem value="month">月</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <SheetFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={pending}>
                {editing ? '保存修改' : '创建'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog
        open={revealed !== null}
        onOpenChange={(open) => !open && setRevealed(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>请立即保存 API Key</DialogTitle>
            <DialogDescription>
              完整 key 仅此一次可见，关闭后将无法再次查看
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border border-input bg-muted/50 p-2">
            <code className="flex-1 break-all text-sm">{revealed?.key}</code>
            <Button variant="outline" size="sm" onClick={copyKey}>
              {copied ? '已复制' : '复制'}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealed(null)}>我已保存，关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={action !== null}
        onOpenChange={(open) => !open && setAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {action?.type === 'revoke' ? '吊销 API Key' : '轮换 API Key'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {action?.type === 'revoke'
                ? `确定要吊销「${action?.key.name ?? action?.key.keyPrefix}」吗？吊销后该 key 立即失效，无法恢复。`
                : `确定要轮换「${action?.key.name ?? action?.key.keyPrefix}」吗？轮换会新建一把 key 并吊销旧 key，新 key 仅展示一次。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={pending}
              onClick={confirmAction}
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
