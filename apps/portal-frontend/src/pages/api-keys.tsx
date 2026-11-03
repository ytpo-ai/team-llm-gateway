import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
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
} from '@/features/api-keys/types'
import { useAuthStore } from '@/features/auth/store'
import { listMembers } from '@/features/teams/api'
import type { Member } from '@/features/teams/types'
import { ApiError } from '@/lib/http'

function formatDate(value: string | null): string {
  if (!value) return '永久'
  return new Date(value).toLocaleDateString()
}

function formatLimits(key: ApiKey): string {
  const parts: string[] = []
  if (key.allowedModels.length > 0) parts.push(`模型: ${key.allowedModels.join(', ')}`)
  if (key.rateLimitPerMinute) parts.push(`${key.rateLimitPerMinute}/min`)
  if (key.maxTokens) parts.push(`预算: ${key.maxTokens.toLocaleString()} tokens`)
  const period = [key.limitDaily, key.limitWeekly, key.limitMonthly]
    .filter((v) => v)
    .map((v) => v!.toLocaleString())
  if (period.length > 0) parts.push(`日/周/月: ${period.join(' / ')}`)
  return parts.length > 0 ? parts.join(' · ') : '不限'
}

interface FormState {
  userId: string
  name: string
  allowedModels: string
  rateLimitPerMinute: string
  maxTokens: string
  limitDaily: string
  limitWeekly: string
  limitMonthly: string
  expiresAt: string
}

const emptyForm: FormState = {
  userId: '',
  name: '',
  allowedModels: '',
  rateLimitPerMinute: '',
  maxTokens: '',
  limitDaily: '',
  limitWeekly: '',
  limitMonthly: '',
  expiresAt: '',
}

function parseModels(raw: string): string[] {
  return raw
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean)
}

function toForm(key: ApiKey): FormState {
  return {
    userId: key.userId,
    name: key.name ?? '',
    allowedModels: key.allowedModels.join(', '),
    rateLimitPerMinute: key.rateLimitPerMinute
      ? String(key.rateLimitPerMinute)
      : '',
    maxTokens: key.maxTokens ? String(key.maxTokens) : '',
    limitDaily: key.limitDaily ? String(key.limitDaily) : '',
    limitWeekly: key.limitWeekly ? String(key.limitWeekly) : '',
    limitMonthly: key.limitMonthly ? String(key.limitMonthly) : '',
    expiresAt: key.expiresAt ? key.expiresAt.slice(0, 10) : '',
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

  const keysQuery = useQuery({ queryKey: ['api-keys'], queryFn: () => listApiKeys() })

  const membersQuery = useQuery({
    queryKey: ['team-members', user?.teamId],
    queryFn: () => listMembers(user!.teamId!),
    enabled: isTeamAdmin && Boolean(user?.teamId),
  })
  const members: Member[] = membersQuery.data ?? []

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
      const models = parseModels(form.allowedModels)
      if (editing) {
        const patch: ApiKeyPatch = {
          userId: form.userId || undefined,
          name: form.name.trim() || null,
          expiresAt: form.expiresAt || null,
          allowedModels: models,
          rateLimitPerMinute: form.rateLimitPerMinute
            ? Number(form.rateLimitPerMinute)
            : null,
          maxTokens: form.maxTokens ? Number(form.maxTokens) : null,
          limitDaily: form.limitDaily ? Number(form.limitDaily) : null,
          limitWeekly: form.limitWeekly ? Number(form.limitWeekly) : null,
          limitMonthly: form.limitMonthly ? Number(form.limitMonthly) : null,
        }
        return updateApiKey(editing.id, patch)
      }
      const input: ApiKeyInput = {
        userId: form.userId || undefined,
        name: form.name.trim() || undefined,
        expiresAt: form.expiresAt || undefined,
        allowedModels: models,
        rateLimitPerMinute: form.rateLimitPerMinute
          ? Number(form.rateLimitPerMinute)
          : undefined,
        maxTokens: form.maxTokens ? Number(form.maxTokens) : undefined,
        limitDaily: form.limitDaily ? Number(form.limitDaily) : undefined,
        limitWeekly: form.limitWeekly ? Number(form.limitWeekly) : undefined,
        limitMonthly: form.limitMonthly ? Number(form.limitMonthly) : undefined,
      }
      return createApiKey(input).then((r) => r.apiKey)
    },
    onSuccess: () => {
      resetForm()
      setFormOpen(false)
      invalidate()
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
            为成员签发 API Key，并按 key 设置模型白名单、速率、预算与过期时间
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
                    <th className="py-2 pr-4 font-medium">限制</th>
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
                        {formatLimits(key)}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {formatDate(key.expiresAt)}
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">
                  模型白名单（逗号分隔，留空不限）
                </label>
                <Input
                  placeholder="gpt-4o-mini, claude-sonnet"
                  value={form.allowedModels}
                  onChange={(e) =>
                    setForm({ ...form, allowedModels: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">
                  过期时间（留空永久）
                </label>
                <Input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) =>
                    setForm({ ...form, expiresAt: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">
                  速率限制（次/分钟，留空不限）
                </label>
                <Input
                  type="number"
                  min={1}
                  placeholder="60"
                  value={form.rateLimitPerMinute}
                  onChange={(e) =>
                    setForm({ ...form, rateLimitPerMinute: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">
                  预算上限（tokens，留空不限）
                </label>
                <Input
                  type="number"
                  min={1}
                  placeholder="1000000"
                  value={form.maxTokens}
                  onChange={(e) => setForm({ ...form, maxTokens: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">
                  日 token 上限（留空不限）
                </label>
                <Input
                  type="number"
                  min={1}
                  placeholder="100000"
                  value={form.limitDaily}
                  onChange={(e) =>
                    setForm({ ...form, limitDaily: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">
                  周 token 上限（留空不限）
                </label>
                <Input
                  type="number"
                  min={1}
                  placeholder="500000"
                  value={form.limitWeekly}
                  onChange={(e) =>
                    setForm({ ...form, limitWeekly: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">
                  月 token 上限（留空不限）
                </label>
                <Input
                  type="number"
                  min={1}
                  placeholder="2000000"
                  value={form.limitMonthly}
                  onChange={(e) =>
                    setForm({ ...form, limitMonthly: e.target.value })
                  }
                />
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
