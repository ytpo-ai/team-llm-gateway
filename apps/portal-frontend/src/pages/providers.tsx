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
import { listOfficialPresets } from '@/features/models/api'
import type { OfficialProviderPreset } from '@/features/models/types'
import {
  createProvider,
  createProviderFromPreset,
  listProviders,
  removeProvider,
  testProvider,
  updateProvider,
} from '@/features/providers/api'
import {
  PROVIDER_AUTH_TYPE_LABELS,
  PROVIDER_TYPE_BASE_URL_HINTS,
  PROVIDER_TYPE_LABELS,
  type Provider,
  type ProviderAuthType,
  type ProviderInput,
  type ProviderPatch,
  type ProviderProbeResult,
  type ProviderType,
} from '@/features/providers/types'
import { ApiError } from '@/lib/http'

const selectClass =
  'h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

interface FormState {
  name: string
  type: ProviderType
  authType: ProviderAuthType
  baseUrl: string
  apiKey: string
}

const emptyForm: FormState = {
  name: '',
  type: 'openai-compatible',
  authType: 'api-key',
  baseUrl: '',
  apiKey: '',
}

export function ProvidersPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'team_admin' || user?.role === 'system'

  const [form, setForm] = useState<FormState>(emptyForm)
  const [editing, setEditing] = useState<Provider | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [probeResults, setProbeResults] = useState<
    Record<string, ProviderProbeResult>
  >({})
  const [probingId, setProbingId] = useState<string | null>(null)

  const [enablePreset, setEnablePreset] =
    useState<OfficialProviderPreset | null>(null)
  const [enableName, setEnableName] = useState('')
  const [enableKey, setEnableKey] = useState('')
  const [enableError, setEnableError] = useState<string | null>(null)
  const [enableResult, setEnableResult] = useState<string | null>(null)

  const providersQuery = useQuery({
    queryKey: ['providers'],
    queryFn: listProviders,
    enabled: isAdmin,
  })

  const presetsQuery = useQuery({
    queryKey: ['official-presets'],
    queryFn: listOfficialPresets,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['providers'] })

  const openEnable = (preset: OfficialProviderPreset) => {
    setEnablePreset(preset)
    setEnableName('')
    setEnableKey('')
    setEnableError(null)
    setEnableResult(null)
  }

  const enableMutation = useMutation({
    mutationFn: () => {
      if (!enablePreset) throw new Error('no preset')
      return createProviderFromPreset({
        presetKey: enablePreset.key,
        apiKey: enableKey.trim(),
        name: enableName.trim() || undefined,
      })
    },
    onSuccess: (result) => {
      setEnableResult(
        `已开启「${result.provider.name}」，导入 ${result.models.created.length} 个模型` +
          (result.models.skipped.length
            ? `，跳过 ${result.models.skipped.length} 个已存在`
            : ''),
      )
      setEnablePreset(null)
      setEnableName('')
      setEnableKey('')
      setEnableError(null)
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['models'] })
    },
    onError: (err) => {
      setEnableError(
        err instanceof ApiError ? err.message : '开启失败，请稍后重试',
      )
    },
  })

  const testMutation = useMutation({
    mutationFn: (id: string) => testProvider(id),
    onMutate: (id) => setProbingId(id),
    onSuccess: (result, id) =>
      setProbeResults((prev) => ({ ...prev, [id]: result })),
    onSettled: () => setProbingId(null),
  })

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
          authType: form.authType,
          baseUrl: form.baseUrl.trim(),
        }
        if (form.apiKey.trim()) patch.apiKey = form.apiKey.trim()
        return updateProvider(editing.id, patch)
      }
      const input: ProviderInput = {
        name: form.name.trim(),
        type: form.type,
        authType: form.authType,
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
      authType: provider.authType ?? 'api-key',
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
  const officialPresets: OfficialProviderPreset[] = presetsQuery.data ?? []

  const providersByPreset: Record<string, Provider[]> = {}
  for (const provider of providers) {
    if (!provider.presetKey) continue
    const list = providersByPreset[provider.presetKey] ?? []
    providersByPreset[provider.presetKey] = list
    list.push(provider)
  }

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
          <CardTitle>官方直连</CardTitle>
          <CardDescription>
            内置主流 LLM 官方直连，默认未开启；填 Key 即可一键开启并自动导入官方模型
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {enableResult && (
            <p className="text-sm text-green-600">{enableResult}</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {officialPresets.map((preset) => {
              const enabled = providersByPreset[preset.key] ?? []
              const open = enablePreset?.key === preset.key
              return (
                <div
                  key={preset.key}
                  className="rounded-md border border-border p-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{preset.label}</span>
                    <span
                      className={`text-xs ${
                        enabled.length
                          ? 'text-green-600'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {enabled.length ? `已开启 ${enabled.length} 个` : '未开启'}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {PROVIDER_TYPE_LABELS[preset.type]} · {preset.models.length}{' '}
                    个官方模型
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {preset.baseUrl}
                  </div>
                  {enabled.length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {enabled.map((p) => p.name).join('、')}
                    </div>
                  )}
                  {open ? (
                    <div className="mt-3 space-y-2">
                      <Input
                        type="password"
                        placeholder="sk-…"
                        value={enableKey}
                        onChange={(e) => setEnableKey(e.target.value)}
                      />
                      <Input
                        placeholder={`渠道名称（默认 ${preset.label}）`}
                        value={enableName}
                        onChange={(e) => setEnableName(e.target.value)}
                      />
                      {enableError && (
                        <p className="text-xs text-red-500">{enableError}</p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={
                            enableMutation.isPending || !enableKey.trim()
                          }
                          onClick={() => enableMutation.mutate()}
                        >
                          {enableMutation.isPending ? '开启中…' : '确认开启'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEnablePreset(null)}
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      className="mt-3"
                      size="sm"
                      variant={enabled.length ? 'outline' : 'default'}
                      onClick={() => openEnable(preset)}
                    >
                      {enabled.length ? '再添加一个' : '开启使用'}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

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
                onChange={(e) => {
                  const type = e.target.value as ProviderType
                  setForm({
                    ...form,
                    type,
                    authType: type === 'gemini' ? form.authType : 'api-key',
                  })
                }}
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
            {form.type === 'gemini' && (
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">
                  认证方式
                </label>
                <select
                  className={`${selectClass} w-full`}
                  value={form.authType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      authType: e.target.value as ProviderAuthType,
                    })
                  }
                >
                  {(
                    Object.keys(PROVIDER_AUTH_TYPE_LABELS) as ProviderAuthType[]
                  ).map((authType) => (
                    <option key={authType} value={authType}>
                      {PROVIDER_AUTH_TYPE_LABELS[authType]}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-muted-foreground">
                Base URL
              </label>
              <Input
                placeholder={PROVIDER_TYPE_BASE_URL_HINTS[form.type]}
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-muted-foreground">
                {form.authType === 'oauth' ? '服务账号 JSON' : '上游 API Key'}
              </label>
              {form.authType === 'oauth' ? (
                <textarea
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder={editing ? '留空表示不修改' : '粘贴服务账号 JSON（含 client_email / private_key）'}
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  required={!editing}
                />
              ) : (
                <Input
                  type="password"
                  placeholder={editing ? '留空表示不修改' : 'sk-…'}
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  required={!editing}
                />
              )}
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
                      <td className="py-2 pr-4">
                        <div>{provider.name}</div>
                        {probeResults[provider.id] && (
                          <div
                            className={`mt-1 text-xs ${
                              probeResults[provider.id].ok
                                ? 'text-green-600'
                                : 'text-red-500'
                            }`}
                          >
                            {probeResults[provider.id].ok ? '连通' : '失败'}（
                            {probeResults[provider.id].latencyMs}ms）{' '}
                            {probeResults[provider.id].message}
                          </div>
                        )}
                      </td>
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
                            disabled={probingId === provider.id}
                            onClick={() => testMutation.mutate(provider.id)}
                          >
                            {probingId === provider.id ? '测试中…' : '测试'}
                          </Button>
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
