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
import { useAuthStore } from '@/features/auth/store'
import {
  createPolicySet,
  deletePolicySet,
  listPolicySets,
  updatePolicySet,
} from '@/features/policy-sets/api'
import {
  ACTION_LABELS,
  MEASURE_LABELS,
  WINDOW_LABELS,
  type CreatePolicySetInput,
  type PolicyAction,
  type PolicyEntry,
  type PolicyMeasure,
  type PolicySet,
  type PolicyWindow,
} from '@/features/policy-sets/types'
import { listProviders } from '@/features/providers/api'
import type { Provider } from '@/features/providers/types'
import { ApiError } from '@/lib/http'

const MEASURES: PolicyMeasure[] = ['token', 'request', 'concurrency', 'spend']
const WINDOWS: PolicyWindow[] = [
  'permanent',
  'minute',
  'hour',
  'day',
  'week',
  'month',
]
const ACTIONS: PolicyAction[] = ['block', 'warn']

interface EntryForm {
  measure: PolicyMeasure
  window: PolicyWindow
  limit: string
  action: PolicyAction
}

interface FormState {
  name: string
  description: string
  modelWhitelist: string
  providerIds: string[]
  entries: EntryForm[]
}

const emptyEntry = (): EntryForm => ({
  measure: 'token',
  window: 'day',
  limit: '',
  action: 'block',
})

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  modelWhitelist: '',
  providerIds: [],
  entries: [emptyEntry()],
})

function parseList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function toForm(set: PolicySet): FormState {
  return {
    name: set.name,
    description: set.description,
    modelWhitelist: set.modelWhitelist.join(', '),
    providerIds: set.providerIds,
    entries:
      set.entries.length > 0
        ? set.entries.map((e) => ({
            measure: e.measure,
            window: e.window,
            limit: String(e.limit),
            action: e.action,
          }))
        : [emptyEntry()],
  }
}

function formatEntry(entry: PolicyEntry): string {
  return `${MEASURE_LABELS[entry.measure]}×${WINDOW_LABELS[entry.window]}≤${entry.limit.toLocaleString()}（${ACTION_LABELS[entry.action]}）`
}

function formatEntries(set: PolicySet): string {
  if (set.entries.length === 0) return '不限'
  return set.entries.map(formatEntry).join('；')
}

export function PolicySetsPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'team_admin' || user?.role === 'system'

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [editing, setEditing] = useState<PolicySet | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<PolicySet | null>(null)

  const setsQuery = useQuery({
    queryKey: ['policy-sets'],
    queryFn: listPolicySets,
  })

  const providersQuery = useQuery({
    queryKey: ['providers'],
    queryFn: listProviders,
    enabled: isAdmin,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['policy-sets'] })

  const resetForm = () => {
    setForm(emptyForm())
    setEditing(null)
    setError(null)
  }

  const openCreate = () => {
    resetForm()
    setFormOpen(true)
  }

  const submitMutation = useMutation({
    mutationFn: () => {
      const entries: PolicyEntry[] = form.entries
        .map((e) => ({
          measure: e.measure,
          window: e.window,
          limit: Number(e.limit),
          action: e.action,
        }))
        .filter((e) => Number.isFinite(e.limit) && e.limit > 0)
      const input: CreatePolicySetInput = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        entries,
        providerIds: form.providerIds,
        modelWhitelist: parseList(form.modelWhitelist),
      }
      if (editing) {
        return updatePolicySet(editing.id, input)
      }
      return createPolicySet(input)
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

  const removeMutation = useMutation({
    mutationFn: (id: string) => deletePolicySet(id),
    onSuccess: () => {
      invalidate()
      setRemoveTarget(null)
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : '操作失败，请稍后重试')
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    submitMutation.mutate()
  }

  const startEdit = (set: PolicySet) => {
    setEditing(set)
    setForm(toForm(set))
    setError(null)
    setFormOpen(true)
  }

  const updateEntry = (index: number, patch: Partial<EntryForm>) => {
    setForm((prev) => ({
      ...prev,
      entries: prev.entries.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    }))
  }

  const addEntry = () => {
    setForm((prev) => ({ ...prev, entries: [...prev.entries, emptyEntry()] }))
  }

  const removeEntry = (index: number) => {
    setForm((prev) => ({
      ...prev,
      entries: prev.entries.filter((_, i) => i !== index),
    }))
  }

  const toggleProvider = (id: string) => {
    setForm((prev) => ({
      ...prev,
      providerIds: prev.providerIds.includes(id)
        ? prev.providerIds.filter((p) => p !== id)
        : [...prev.providerIds, id],
    }))
  }

  const sets: PolicySet[] = setsQuery.data ?? []
  const providers: Provider[] = providersQuery.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">策略管理</h1>
          <p className="text-sm text-muted-foreground">
            预设限制策略集（用量上限与渠道/模型白名单），挂载到团队、角色与 API Key
          </p>
        </div>
        {isAdmin && <Button onClick={openCreate}>新建策略集</Button>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>策略集列表</CardTitle>
        </CardHeader>
        <CardContent>
          {setsQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">加载中…</div>
          ) : sets.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              暂无策略集，点击右上角新建。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">名称</th>
                    <th className="py-2 pr-4 font-medium">描述</th>
                    <th className="py-2 pr-4 font-medium">用量条目</th>
                    <th className="py-2 pr-4 font-medium">类型</th>
                    {isAdmin && <th className="py-2 font-medium">操作</th>}
                  </tr>
                </thead>
                <tbody>
                  {sets.map((set) => (
                    <tr key={set.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{set.name}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {set.description || '—'}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {formatEntries(set)}
                      </td>
                      <td className="py-2 pr-4">
                        {set.builtIn ? (
                          <span className="text-muted-foreground">内置</span>
                        ) : (
                          <span className="text-green-600">自定义</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="py-2">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEdit(set)}
                            >
                              编辑
                            </Button>
                            {!set.builtIn && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRemoveTarget(set)}
                              >
                                删除
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editing ? '编辑策略集' : '新建策略集'}</SheetTitle>
            <SheetDescription>
              用量条目留空或不填限值表示不限制；内置策略集不可删除
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
                placeholder="研发默认"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                描述（可选）
              </label>
              <Input
                placeholder="该策略集的用途说明"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                用量条目
              </label>
              <div className="space-y-2">
                {form.entries.map((entry, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Select
                      value={entry.measure}
                      onValueChange={(v) =>
                        updateEntry(index, { measure: v as PolicyMeasure })
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MEASURES.map((m) => (
                          <SelectItem key={m} value={m}>
                            {MEASURE_LABELS[m]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={entry.window}
                      onValueChange={(v) =>
                        updateEntry(index, { window: v as PolicyWindow })
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WINDOWS.map((w) => (
                          <SelectItem key={w} value={w}>
                            {WINDOW_LABELS[w]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={0}
                      placeholder="限值"
                      className="flex-1"
                      value={entry.limit}
                      onChange={(e) =>
                        updateEntry(index, { limit: e.target.value })
                      }
                    />
                    <Select
                      value={entry.action}
                      onValueChange={(v) =>
                        updateEntry(index, { action: v as PolicyAction })
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTIONS.map((a) => (
                          <SelectItem key={a} value={a}>
                            {ACTION_LABELS[a]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeEntry(index)}
                    >
                      删除
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addEntry}>
                  添加条目
                </Button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                可用模型白名单（逗号分隔，留空 = 全部）
              </label>
              <Input
                placeholder="gpt-4o-mini, claude-3-5-sonnet"
                value={form.modelWhitelist}
                onChange={(e) =>
                  setForm({ ...form, modelWhitelist: e.target.value })
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                可用渠道白名单（不勾选 = 全部）
              </label>
              <div className="space-y-1 rounded-md border border-input p-2">
                {providers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">暂无渠道</p>
                ) : (
                  providers.map((provider) => (
                    <label
                      key={provider.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={form.providerIds.includes(provider.id)}
                        onChange={() => toggleProvider(provider.id)}
                      />
                      {provider.name}
                    </label>
                  ))
                )}
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
              <Button type="submit" disabled={submitMutation.isPending}>
                {editing ? '保存修改' : '创建'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除策略集</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除策略集「{removeTarget?.name}」吗？挂载该策略集的团队/角色/Key
              将回退为不限。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeMutation.isPending}
              onClick={() =>
                removeTarget && removeMutation.mutate(removeTarget.id)
              }
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
