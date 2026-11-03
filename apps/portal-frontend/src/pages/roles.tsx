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
import { listPolicySets } from '@/features/policy-sets/api'
import type { PolicySet } from '@/features/policy-sets/types'
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
  policySetId: string
}

const emptyForm: FormState = {
  name: '',
  description: '',
  policySetId: '',
}

function toForm(template: RoleTemplate): FormState {
  return {
    name: template.name,
    description: template.description,
    policySetId: template.policySetId ?? '',
  }
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

  const policySetsQuery = useQuery({
    queryKey: ['policy-sets'],
    queryFn: listPolicySets,
    enabled: isAdmin,
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
      const base: CreateRoleTemplateInput = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        policySetId: form.policySetId || undefined,
      }
      if (editing) {
        return updateRoleTemplate(editing.id, {
          ...base,
          policySetId: form.policySetId || null,
        })
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
  const policySets: PolicySet[] = policySetsQuery.data ?? []

  const policySetName = (id: string | null) =>
    policySets.find((s) => s.id === id)?.name ?? '不限'

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">角色管理</h1>
          <p className="text-sm text-muted-foreground">
            通过角色区分成员的 LLM 使用能力，绑定策略集下发额度与渠道/模型范围
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
                    <th className="py-2 pr-4 font-medium">策略集</th>
                    <th className="py-2 pr-4 font-medium">类型</th>
                    {isAdmin && <th className="py-2 font-medium">操作</th>}
                  </tr>
                </thead>
                <tbody>
                  {templates.map((template) => (
                    <tr key={template.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{template.name}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {policySetName(template.policySetId)}
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
              内置角色不可删除，但可修改；未绑定策略集表示不限制
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
                placeholder="该角色的用途说明"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
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
