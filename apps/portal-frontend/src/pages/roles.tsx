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

  const [form, setForm] = useState<FormState>(emptyForm)
  const [editing, setEditing] = useState<RoleTemplate | null>(null)
  const [error, setError] = useState<string | null>(null)

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
      invalidate()
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : '操作失败，请稍后重试')
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeRoleTemplate(id),
    onSuccess: invalidate,
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
  }

  const templates: RoleTemplate[] = templatesQuery.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">角色管理</h1>
        <p className="text-sm text-muted-foreground">
          通过角色区分成员的 LLM 使用能力（额度上限与可用渠道/模型）
        </p>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? '编辑角色' : '添加角色'}</CardTitle>
            <CardDescription>
              内置角色不可删除，但可修改；额度留空表示不限制
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
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
              <div className="sm:col-span-2">
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

              {error && (
                <p className="text-sm text-red-500 sm:col-span-2">{error}</p>
              )}

              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={submitMutation.isPending}>
                  {editing ? '保存修改' : '添加'}
                </Button>
                {editing && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    取消
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>角色列表</CardTitle>
        </CardHeader>
        <CardContent>
          {templatesQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">加载中…</div>
          ) : templates.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              暂无角色，点击上方添加。
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
                                disabled={removeMutation.isPending}
                                onClick={() =>
                                  removeMutation.mutate(template.id)
                                }
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
    </div>
  )
}
