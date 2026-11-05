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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/features/auth/store'
import { listOfficialPresets } from '@/features/models/api'
import type { OfficialProviderPreset } from '@/features/models/types'
import {
  createProvider,
  createProviderFromPreset,
  deleteProvider,
  disableProvider,
  enableProvider,
  listProviders,
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

const NONE_PRESET = '__none__'

interface FormState {
  name: string
  type: ProviderType
  authType: ProviderAuthType
  baseUrl: string
  apiKey: string
  presetKey: string
}

const emptyForm: FormState = {
  name: '',
  type: 'openai-compatible',
  authType: 'api-key',
  baseUrl: '',
  apiKey: '',
  presetKey: '',
}

export function ProvidersPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'team_admin' || user?.role === 'system'

  const [addOpen, setAddOpen] = useState(false)
  const [addTab, setAddTab] = useState<string>('official')
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editing, setEditing] = useState<Provider | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{
    provider: Provider
    kind: 'disable' | 'delete'
  } | null>(null)
  const [probeResults, setProbeResults] = useState<
    Record<string, ProviderProbeResult>
  >({})
  const [probingId, setProbingId] = useState<string | null>(null)

  const [enablePreset, setEnablePreset] =
    useState<OfficialProviderPreset | null>(null)
  const [enableFormat, setEnableFormat] = useState<ProviderType>('openai-compatible')
  const [enableUrl, setEnableUrl] = useState('')
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
    const first = preset.formats[0]
    setEnablePreset(preset)
    setEnableFormat(first?.type ?? 'openai-compatible')
    setEnableUrl(first?.baseUrl ?? '')
    setEnableName('')
    setEnableKey('')
    setEnableError(null)
  }

  const selectEnableFormat = (type: ProviderType) => {
    const format = enablePreset?.formats.find((f) => f.type === type)
    setEnableFormat(type)
    setEnableUrl(format?.baseUrl ?? '')
  }

  const enableMutation = useMutation({
    mutationFn: () => {
      if (!enablePreset) throw new Error('no preset')
      return createProviderFromPreset({
        presetKey: enablePreset.key,
        apiKey: enableKey.trim(),
        name: enableName.trim() || undefined,
        format: enableFormat,
        baseUrl: enableUrl.trim() || undefined,
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
      setAddOpen(false)
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

  const openCreate = () => {
    resetForm()
    setCreateOpen(true)
  }

  const submitMutation = useMutation({
    mutationFn: () => {
      if (editing) {
        const patch: ProviderPatch = {
          name: form.name.trim(),
          type: form.type,
          authType: form.authType,
          baseUrl: form.baseUrl.trim(),
          presetKey: form.presetKey.trim(),
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
      setCreateOpen(false)
      setEditOpen(false)
      invalidate()
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : '操作失败，请稍后重试')
    },
  })

  const disableMutation = useMutation({
    mutationFn: (id: string) => disableProvider(id),
    onSuccess: () => {
      invalidate()
      setConfirm(null)
    },
  })

  const enableProviderMutation = useMutation({
    mutationFn: (id: string) => enableProvider(id),
    onSuccess: () => invalidate(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProvider(id),
    onSuccess: () => {
      invalidate()
      setConfirm(null)
    },
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
      presetKey: provider.presetKey ?? '',
    })
    setError(null)
    setEditOpen(true)
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
  const officialOnlyPresets = officialPresets.filter(
    (p) => p.category !== 'service-provider',
  )
  const serviceProviderPresets = officialPresets.filter(
    (p) => p.category === 'service-provider',
  )

  const formBody = (
    <>
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
        <Select
          value={form.type}
          onValueChange={(v) => {
            const type = v as ProviderType
            setForm({
              ...form,
              type,
              authType: type === 'gemini' ? form.authType : 'api-key',
            })
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PROVIDER_TYPE_LABELS) as ProviderType[]).map(
              (type) => (
                <SelectItem key={type} value={type}>
                  {PROVIDER_TYPE_LABELS[type]}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </div>
      {editing && (
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">
            是否官方渠道
          </label>
          <Select
            value={form.presetKey || NONE_PRESET}
            onValueChange={(v) =>
              setForm({
                ...form,
                presetKey: v === NONE_PRESET ? '' : v,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_PRESET}>无（普通渠道）</SelectItem>
              {officialPresets.map((preset) => (
                <SelectItem key={preset.key} value={preset.key}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {form.type === 'gemini' && (
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">
            认证方式
          </label>
          <Select
            value={form.authType}
            onValueChange={(v) =>
              setForm({ ...form, authType: v as ProviderAuthType })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PROVIDER_AUTH_TYPE_LABELS) as ProviderAuthType[]).map(
                (authType) => (
                  <SelectItem key={authType} value={authType}>
                    {PROVIDER_AUTH_TYPE_LABELS[authType]}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
      )}
      <div>
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
      <div>
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
      {error && <p className="text-sm text-red-500">{error}</p>}
    </>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">上游渠道</h1>
          <p className="text-sm text-muted-foreground">
            配置团队上游（OpenAI 兼容 / 直连），上游 key 加密存储、仅展示脱敏信息
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>添加渠道</Button>
      </div>

      {enableResult && (
        <p className="text-sm text-green-600">{enableResult}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>渠道列表</CardTitle>
        </CardHeader>
        <CardContent>
          {providersQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">加载中…</div>
          ) : providers.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              暂无上游渠道，点击右上角添加。
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
                          {provider.status === 'active' ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setConfirm({ provider, kind: 'disable' })
                                }
                              >
                                禁用
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() =>
                                  setConfirm({ provider, kind: 'delete' })
                                }
                              >
                                删除
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  enableProviderMutation.mutate(provider.id)
                                }
                              >
                                启用
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() =>
                                  setConfirm({ provider, kind: 'delete' })
                                }
                              >
                                删除
                              </Button>
                            </>
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

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>添加渠道</DialogTitle>
            <DialogDescription>
              手动配置自定义渠道，或从官方渠道/服务商快捷开启
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => {
                setAddOpen(false)
                openCreate()
              }}
              className="flex w-full items-center justify-between rounded-md border border-dashed border-border p-3 text-left text-sm transition-colors hover:bg-accent"
            >
              <span>
                <span className="font-medium">自定义渠道</span>
                <span className="block text-xs text-muted-foreground">
                  手动填写名称 / 协议 / Base URL / Key
                </span>
              </span>
              <span className="text-lg text-muted-foreground">＋</span>
            </button>

            <Tabs value={addTab} onValueChange={setAddTab}>
              <TabsList className="w-full">
                <TabsTrigger value="official" className="flex-1">
                  官方渠道
                </TabsTrigger>
                <TabsTrigger value="service-provider" className="flex-1">
                  服务商
                </TabsTrigger>
              </TabsList>
              <TabsContent value="official">
                <div className="grid gap-2 sm:grid-cols-2">
                  {officialOnlyPresets.map((preset) => (
                    <div
                      key={preset.key}
                      className="flex items-center justify-between rounded-md border border-border p-3 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-medium">{preset.label}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {preset.formats
                            .map((f) => PROVIDER_TYPE_LABELS[f.type])
                            .join(' / ')}{' '}
                          · {preset.models.length} 个模型
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAddOpen(false)
                          openEnable(preset)
                        }}
                      >
                        开启
                      </Button>
                    </div>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="service-provider">
                {serviceProviderPresets.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    暂无内置服务商，敬请期待
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {serviceProviderPresets.map((preset) => (
                      <div
                        key={preset.key}
                        className="flex items-center justify-between rounded-md border border-border p-3 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="font-medium">{preset.label}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {preset.formats
                              .map((f) => PROVIDER_TYPE_LABELS[f.type])
                              .join(' / ')}{' '}
                            · {preset.models.length} 个模型
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setAddOpen(false)
                            openEnable(preset)
                          }}
                        >
                          开启
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>添加自定义渠道</DialogTitle>
            <DialogDescription>
              上游 key 提交后不可再次查看，仅显示脱敏信息
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid max-h-[75vh] gap-4 overflow-y-auto"
            onSubmit={handleSubmit}
          >
            {formBody}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={submitMutation.isPending}>
                添加
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>编辑渠道</SheetTitle>
            <SheetDescription>
              正在编辑 {editing?.name}（留空 key 表示保持不变）
            </SheetDescription>
          </SheetHeader>
          <form
            className="flex flex-1 flex-col gap-4 overflow-y-auto"
            onSubmit={handleSubmit}
          >
            {formBody}
            <SheetFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={submitMutation.isPending}>
                保存修改
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog
        open={enablePreset !== null}
        onOpenChange={(open) => !open && setEnablePreset(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>开启「{enablePreset?.label}」</DialogTitle>
            <DialogDescription>
              选择接入格式（可修改 URL），填 Key 即可一键开启并自动导入官方模型
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                接入格式
              </label>
              <Select
                value={enableFormat}
                onValueChange={(v) => selectEnableFormat(v as ProviderType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {enablePreset?.formats.map((format) => (
                    <SelectItem key={format.type} value={format.type}>
                      {PROVIDER_TYPE_LABELS[format.type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                Base URL
              </label>
              <Input
                value={enableUrl}
                onChange={(e) => setEnableUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                API Key
              </label>
              <Input
                type="password"
                placeholder="sk-…"
                value={enableKey}
                onChange={(e) => setEnableKey(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                渠道名称（可选）
              </label>
              <Input
                placeholder={`渠道名称（默认 ${enablePreset?.label}）`}
                value={enableName}
                onChange={(e) => setEnableName(e.target.value)}
              />
            </div>
            {enableError && (
              <p className="text-sm text-red-500">{enableError}</p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEnablePreset(null)}
              >
                取消
              </Button>
              <Button
                disabled={enableMutation.isPending || !enableKey.trim()}
                onClick={() => enableMutation.mutate()}
              >
                {enableMutation.isPending ? '开启中…' : '确认开启'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === 'disable' ? '禁用渠道' : '删除渠道'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === 'disable'
                ? `确定要禁用上游渠道「${confirm.provider.name}」吗？禁用后该渠道及其下模型将不可用，可随时重新启用。`
                : `确定要删除上游渠道「${confirm?.provider.name}」吗？将永久删除该渠道及其下所有模型，此操作不可恢复。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirm?.kind === 'delete'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : ''
              }
              disabled={disableMutation.isPending || deleteMutation.isPending}
              onClick={() => {
                if (!confirm) return
                if (confirm.kind === 'disable') {
                  disableMutation.mutate(confirm.provider.id)
                } else {
                  deleteMutation.mutate(confirm.provider.id)
                }
              }}
            >
              {confirm?.kind === 'disable' ? '禁用' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
