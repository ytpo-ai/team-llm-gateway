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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useAuthStore } from '@/features/auth/store'
import {
  createRoleTemplate,
  listRoleTemplates,
  removeRoleTemplate,
  updateRoleTemplate,
} from '@/features/role-templates/api'
import type {
  CreateRoleTemplateInput,
  RoleTemplate,
} from '@/features/role-templates/types'
import { ApiError } from '@/lib/http'

interface FormState {
  name: string
  description: string
  limitDaily: string
  limitWeekly: string
  limitMonthly: string
  rateLimitPerMinute: string
  modelWhitelist: string
}

const emptyForm: FormState = {
  name: '',
  description: '',
  limitDaily: '',
  limitWeekly: '',
  limitMonthly: '',
  rateLimitPerMinute: '',
  modelWhitelist: '',
}

function parseList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function toNumber(raw: string): number | undefined {
  const value = raw.trim()
  return value === '' ? undefined : Number(value)
}

function toForm(template: RoleTemplate): FormState {
  return {
    name: template.name,
    description: template.description,
    limitDaily: template.limitDaily != null ? String(template.limitDaily) : '',
    limitWeekly: template.limitWeekly != null ? String(template.limitWeekly) : '',
    limitMonthly:
      template.limitMonthly != null ? String(template.limitMonthly) : '',
    rateLimitPerMinute:
      template.rateLimitPerMinute != null
        ? String(template.rateLimitPerMinute)
        : '',
    modelWhitelist: template.modelWhitelist.join(', '),
  }
}

function formatLimit(value: number | null): string {
  return value == null ? '不限' : value.toLocaleString()
}

export function RolesPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'team_admin' || user?.role === 'system'

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editing, setEditing] = useState<RoleTemplate | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<RoleTemplate | null>(null)

  const templatesQuery = useQuery({
    queryKey: ['role-templates'],
    queryFn: listRoleTemplates,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['role-templates'] })

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
      const modelWhitelist = parseList(form.modelWhitelist)
      const base: CreateRoleTemplateInput = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        limitDaily: toNumber(form.limitDaily),
        limitWeekly: toNumber(form.limitWeekly),
        limitMonthly: toNumber(form.limitMonthly),
        rateLimitPerMinute: toNumber(form.rateLimitPerMinute),
        modelWhitelist,
      }
      if (editing) {
        return updateRoleTemplate(editing.id, base)
      }
      return createRoleTemplate(base)
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
    mutationFn: (id: string) => removeRoleTemplate(id),
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

  const startEdit = (template: RoleTemplate) => {
    setEditing(template)
    setForm(toForm(template))
    setError(null)
    setFormOpen(true)
  }

  const templates: RoleTemplate[] = templatesQuery.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">角色管理</h1>
          <p className="text-sm text-muted-foreground">
            通过角色区分成员的 LLM 使用能力（额度上限与可用渠道/模型）
          </p>
        </div>
        {isAdmin && <Button onClick={openCreate}>添加角色</Button>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>角色列表</CardTitle>
        </CardHeader>
        <CardContent>
          {templatesQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">加载中…</div>
          ) : templates.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              暂无角色，点击右上角添加。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">名称</th>
                    <th className="py-2 pr-4 font-medium">日 / 周 / 月上限</th>
                    <th className="py-2 pr-4 font-medium">每分钟速率</th>
                    <th className="py-2 pr-4 font-medium">模型白名单</th>
                    <th className="py-2 pr-4 font-medium">类型</th>
                    {isAdmin && <th className="py-2 font-medium">操作</th>}
                  </tr>
                </thead>
                <tbody>
                  {templates.map((template) => (
                    <tr key={template.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{template.name}</td>
                      <td className="py-2 pr-4">
                        {formatLimit(template.limitDaily)} /{' '}
                        {formatLimit(template.limitWeekly)} /{' '}
                        {formatLimit(template.limitMonthly)}
                      </td>
                      <td className="py-2 pr-4">
                        {formatLimit(template.rateLimitPerMinute)}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {template.modelWhitelist.length > 0
                          ? template.modelWhitelist.join(', ')
                          : '全部'}
                      </td>
                      <td className="py-2 pr-4">
                        {template.builtIn ? (
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
                              onClick={() => startEdit(template)}
                            >
                              编辑
                            </Button>
                            {!template.builtIn && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRemoveTarget(template)}
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
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? '编辑角色' : '添加角色'}</SheetTitle>
            <SheetDescription>
              内置角色不可删除，但可修改；额度留空表示不限制
            </SheetDescription>
          </SheetHeader>
          <form
            className="flex flex-1 flex-col gap-4 overflow-y-auto"
            onSubmit={handleSubmit}
          >
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                角色名称
              </label>
              <Input
                placeholder="设计师"
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
                placeholder="该角色可用的模型与额度说明"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">
                  日 token 上限（留空不限）
                </label>
                <Input
                  type="number"
                  min={0}
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
                  min={0}
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
                  min={0}
                  value={form.limitMonthly}
                  onChange={(e) =>
                    setForm({ ...form, limitMonthly: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">
                  每分钟速率（留空不限）
                </label>
                <Input
                  type="number"
                  min={0}
                  value={form.rateLimitPerMinute}
                  onChange={(e) =>
                    setForm({ ...form, rateLimitPerMinute: e.target.value })
                  }
                />
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
                {editing ? '保存修改' : '添加'}
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
            <AlertDialogTitle>删除角色</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除角色「{removeTarget?.name}」吗？已分配该角色的成员将失去对应额度限制。
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
