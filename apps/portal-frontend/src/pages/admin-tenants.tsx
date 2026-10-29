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
  createTenant,
  listTenants,
  updateTenantStatus,
} from '@/features/admin/api'
import type { Tenant, TenantStatus } from '@/features/admin/types'

const STATUS_LABEL: Record<TenantStatus, string> = {
  active: '启用',
  suspended: '停用',
}

function fmtDate(value?: string): string {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

interface CreateFormState {
  code: string
  name: string
}

export function AdminTenantsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<CreateFormState>({ code: '', name: '' })
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const tenantsQuery = useQuery({
    queryKey: ['admin', 'tenants', search],
    queryFn: () => listTenants({ search: search || undefined }),
  })

  const createMutation = useMutation({
    mutationFn: createTenant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      setMessage('租户已创建')
      setError(null)
      setForm({ code: '', name: '' })
    },
    onError: (err: Error) => setError(err.message),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TenantStatus }) =>
      updateTenantStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      setMessage('状态已更新')
      setError(null)
    },
    onError: (err: Error) => setError(err.message),
  })

  const tenants: Tenant[] = tenantsQuery.data?.items ?? []

  const handleCreate = (e: FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setError(null)
    if (!form.code.trim() || !form.name.trim()) {
      setError('请填写租户编码与名称')
      return
    }
    createMutation.mutate({ code: form.code.trim(), name: form.name.trim() })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">租户管理</h1>
        <p className="text-sm text-muted-foreground">
          多租户管理（仅 system 服务商角色可见）
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>新建租户</CardTitle>
          <CardDescription>创建租户并自动初始化默认团队</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Input
                placeholder="租户编码（唯一，如 acme）"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                className="w-48"
              />
              <Input
                placeholder="租户名称"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-64"
              />
              <Button type="submit" disabled={createMutation.isPending}>
                创建
              </Button>
            </div>
            {message && <p className="text-sm text-green-600">{message}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>租户列表</CardTitle>
          <CardDescription>
            共 {tenantsQuery.data?.total ?? 0} 个租户
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="按编码 / 名称搜索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          {tenantsQuery.isLoading ? (
            <div className="py-6 text-sm text-muted-foreground">加载中…</div>
          ) : tenants.length === 0 ? (
            <div className="py-6 text-sm text-muted-foreground">暂无租户</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">名称</th>
                  <th className="py-2 pr-4 font-medium">编码</th>
                  <th className="py-2 pr-4 text-right font-medium">团队</th>
                  <th className="py-2 pr-4 text-right font-medium">成员</th>
                  <th className="py-2 pr-4 text-right font-medium">Key</th>
                  <th className="py-2 pr-4 font-medium">状态</th>
                  <th className="py-2 pr-4 font-medium">创建时间</th>
                  <th className="py-2 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{tenant.name}</td>
                    <td className="py-2 pr-4">
                      <code className="text-xs">{tenant.code}</code>
                    </td>
                    <td className="py-2 pr-4 text-right">{tenant.teamCount}</td>
                    <td className="py-2 pr-4 text-right">{tenant.memberCount}</td>
                    <td className="py-2 pr-4 text-right">{tenant.apiKeyCount}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={
                          tenant.status === 'active'
                            ? 'text-green-600'
                            : 'text-destructive'
                        }
                      >
                        {STATUS_LABEL[tenant.status]}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{fmtDate(tenant.createdAt)}</td>
                    <td className="py-2 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={statusMutation.isPending}
                        onClick={() =>
                          statusMutation.mutate({
                            id: tenant.id,
                            status:
                              tenant.status === 'active' ? 'suspended' : 'active',
                          })
                        }
                      >
                        {tenant.status === 'active' ? '停用' : '启用'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
