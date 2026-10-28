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
  createProvider,
  listProviders,
  removeProvider,
  updateProvider,
} from '@/features/providers/api'
import {
  PROVIDER_TYPE_LABELS,
  type Provider,
  type ProviderInput,
  type ProviderPatch,
  type ProviderType,
} from '@/features/providers/types'
import { ApiError } from '@/lib/http'

const selectClass =
  'h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

interface FormState {
  name: string
  type: ProviderType
  baseUrl: string
  apiKey: string
}

const emptyForm: FormState = {
  name: '',
  type: 'openai-compatible',
  baseUrl: '',
  apiKey: '',
}

export function ProvidersPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'team_admin'

  const [form, setForm] = useState<FormState>(emptyForm)
  const [editing, setEditing] = useState<Provider | null>(null)
  const [error, setError] = useState<string | null>(null)

  const providersQuery = useQuery({
    queryKey: ['providers'],
    queryFn: listProviders,
    enabled: isAdmin,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['providers'] })

  const resetForm = () => {
    setForm(emptyForm)
    setEditing(null)
    setError(null)
  }

  const submitMutation = useMutation({
    mutationFn: () => {
      if (editing) {
        const patch: ProviderPatch = {
          name: form.name.trim(),
          type: form.type,
          baseUrl: form.baseUrl.trim(),
        }
        if (form.apiKey.trim()) patch.apiKey = form.apiKey.trim()
        return updateProvider(editing.id, patch)
      }
      const input: ProviderInput = {
        name: form.name.trim(),
        type: form.type,
        baseUrl: form.baseUrl.trim(),
        apiKey: form.apiKey.trim(),
      }
      return createProvider(input)
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
    mutationFn: (id: string) => removeProvider(id),
    onSuccess: invalidate,
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    submitMutation.mutate()
  }

  const startEdit = (provider: Provider) => {
    setEditing(provider)
    setForm({
      name: provider.name,
      type: provider.type,
      baseUrl: provider.baseUrl,
      apiKey: '',
    })
    setError(null)
  }

  if (!isAdmin) {
    return (
      <div className="text-sm text-muted-foreground">
        仅团队管理员可管理上游渠道。
      </div>
    )
  }

  const providers: Provider[] = providersQuery.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">上游渠道</h1>
        <p className="text-sm text-muted-foreground">
          配置团队上游（OpenAI 兼容 / 直连），上游 key 加密存储、仅展示脱敏信息
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editing ? '编辑渠道' : '添加上游渠道'}</CardTitle>
          <CardDescription>
            {editing
              ? `正在编辑 ${editing.name}（留空 key 表示保持不变）`
              : '上游 key 提交后不可再次查看，仅显示脱敏信息'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                渠道名称
              </label>
              <Input
                placeholder="如：OpenAI 直连"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                协议类型
              </label>
              <select
                className={`${selectClass} w-full`}
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as ProviderType })
                }
              >
                {(Object.keys(PROVIDER_TYPE_LABELS) as ProviderType[]).map(
                  (type) => (
                    <option key={type} value={type}>
                      {PROVIDER_TYPE_LABELS[type]}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-muted-foreground">
                Base URL
              </label>
              <Input
                placeholder="https://api.openai.com/v1"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-muted-foreground">
                上游 API Key
              </label>
              <Input
                type="password"
                placeholder={editing ? '留空表示不修改' : 'sk-…'}
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                required={!editing}
              />
            </div>

            {error && <p className="text-sm text-red-500 sm:col-span-2">{error}</p>}

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

      <Card>
        <CardHeader>
          <CardTitle>渠道列表</CardTitle>
        </CardHeader>
        <CardContent>
          {providersQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">加载中…</div>
          ) : providers.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              暂无上游渠道，点击上方添加。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">名称</th>
                    <th className="py-2 pr-4 font-medium">类型</th>
                    <th className="py-2 pr-4 font-medium">Base URL</th>
                    <th className="py-2 pr-4 font-medium">Key</th>
                    <th className="py-2 pr-4 font-medium">状态</th>
                    <th className="py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map((provider) => (
                    <tr key={provider.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{provider.name}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {PROVIDER_TYPE_LABELS[provider.type]}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {provider.baseUrl}
                      </td>
                      <td className="py-2 pr-4">
                        <code className="text-xs">{provider.apiKeyHint}</code>
                      </td>
                      <td className="py-2 pr-4">
                        {provider.status === 'active' ? (
                          <span className="text-green-600">正常</span>
                        ) : (
                          <span className="text-muted-foreground">已禁用</span>
                        )}
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(provider)}
                          >
                            编辑
                          </Button>
                          {provider.status === 'active' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={removeMutation.isPending}
                              onClick={() => removeMutation.mutate(provider.id)}
                            >
                              删除
                            </Button>
                          )}
                        </div>
                      </td>
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
