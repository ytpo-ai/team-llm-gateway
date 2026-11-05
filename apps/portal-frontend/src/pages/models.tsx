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
  bulkCreateModels,
  createModel,
  deleteModel,
  disableModel,
  enableModel,
  listModels,
  listOfficialPresets,
  updateModel,
} from '@/features/models/api'
import type { Model, ModelInput, ModelPatch, ProviderBindingInput } from '@/features/models/types'
import { listProviders } from '@/features/providers/api'
import type { Provider } from '@/features/providers/types'
import { ApiError } from '@/lib/http'

interface BindingFormEntry {
  providerId: string
  priority: string
}

interface FormState {
  providerId: string
  bindings: BindingFormEntry[]
  modelId: string
  displayName: string
  multiplier: string
  capabilities: string
  aliases: string
}

const emptyBinding: BindingFormEntry = { providerId: '', priority: '0' }

const emptyForm: FormState = {
  providerId: '',
  bindings: [],
  modelId: '',
  displayName: '',
  multiplier: '1',
  capabilities: '',
  aliases: '',
}

function parseList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function toForm(model: Model): FormState {
  const extraBindings = model.providerBindings
    .filter((b) => b.providerId !== model.providerId)
    .map((b) => ({
      providerId: b.providerId,
      priority: String(b.priority),
    }))

  return {
    providerId: model.providerId,
    bindings: extraBindings,
    modelId: model.modelId,
    displayName: model.displayName,
    multiplier: String(model.multiplier),
    capabilities: model.capabilities.join(', '),
    aliases: model.aliases.join(', '),
  }
}

export function ModelsPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'team_admin' || user?.role === 'system'

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editing, setEditing] = useState<Model | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{
    model: Model
    kind: 'disable' | 'delete'
  } | null>(null)

  const [importOpen, setImportOpen] = useState(false)
  const [presetKey, setPresetKey] = useState<string>('')
  const [importProviderId, setImportProviderId] = useState('')
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [importResult, setImportResult] = useState<string | null>(null)

  const modelsQuery = useQuery({ queryKey: ['models'], queryFn: listModels })

  const presetsQuery = useQuery({
    queryKey: ['official-presets'],
    queryFn: listOfficialPresets,
  })

  const providersQuery = useQuery({
    queryKey: ['providers'],
    queryFn: listProviders,
    enabled: isAdmin,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['models'] })

  const officialPresets = presetsQuery.data ?? []
  const activePreset = officialPresets.find((p) => p.key === presetKey)

  const toggleModel = (modelId: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId],
    )
  }

  const openImport = () => {
    setPresetKey(officialPresets[0]?.key ?? '')
    setImportProviderId('')
    setSelectedModels([])
    setImportResult(null)
    setImportOpen(true)
  }

  const importMutation = useMutation({
    mutationFn: () => {
      const preset = activePreset
      const models = (preset?.models ?? [])
        .filter((m) => selectedModels.includes(m.modelId))
        .map((m) => ({
          modelId: m.modelId,
          displayName: m.displayName,
          multiplier: m.multiplier,
          capabilities: m.capabilities,
          aliases: [],
        }))
      return bulkCreateModels({ providerId: importProviderId, models })
    },
    onSuccess: (result) => {
      setImportResult(
        `导入完成：新增 ${result.created.length} 个，跳过 ${result.skipped.length} 个（已存在）`,
      )
      setSelectedModels([])
      invalidate()
    },
    onError: (err) => {
      setImportResult(
        err instanceof ApiError ? err.message : '导入失败，请稍后重试',
      )
    },
  })

  const resetForm = () => {
    setForm(emptyForm)
    setEditing(null)
    setError(null)
  }

  const openCreate = () => {
    resetForm()
    setFormOpen(true)
  }

  const addBinding = () => {
    setForm({ ...form, bindings: [...form.bindings, { ...emptyBinding }] })
  }

  const removeBinding = (index: number) => {
    setForm({
      ...form,
      bindings: form.bindings.filter((_, i) => i !== index),
    })
  }

  const updateBinding = (index: number, field: keyof BindingFormEntry, value: string) => {
    const updated = [...form.bindings]
    updated[index] = { ...updated[index], [field]: value }
    setForm({ ...form, bindings: updated })
  }

  const buildProviderBindings = (): ProviderBindingInput[] | undefined => {
    const valid = form.bindings
      .filter((b) => b.providerId && b.providerId !== form.providerId)
      .map((b) => ({
        providerId: b.providerId,
        priority: Number(b.priority) || 0,
      }))
    return valid.length > 0 ? valid : undefined
  }

  const submitMutation = useMutation({
    mutationFn: () => {
      const capabilities = parseList(form.capabilities)
      const aliases = parseList(form.aliases)
      const providerBindings = buildProviderBindings()

      if (editing) {
        const patch: ModelPatch = {
          providerId: form.providerId,
          providerBindings,
          modelId: form.modelId.trim(),
          displayName: form.displayName.trim(),
          multiplier: form.multiplier ? Number(form.multiplier) : 1,
          capabilities,
          aliases,
        }
        return updateModel(editing.id, patch)
      }
      const input: ModelInput = {
        providerId: form.providerId,
        providerBindings,
        modelId: form.modelId.trim(),
        displayName: form.displayName.trim() || undefined,
        multiplier: form.multiplier ? Number(form.multiplier) : undefined,
        capabilities,
        aliases,
      }
      return createModel(input)
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

  const disableMutation = useMutation({
    mutationFn: (id: string) => disableModel(id),
    onSuccess: () => {
      invalidate()
      setConfirm(null)
    },
  })

  const enableMutation = useMutation({
    mutationFn: (id: string) => enableModel(id),
    onSuccess: () => invalidate(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteModel(id),
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

  const startEdit = (model: Model) => {
    setEditing(model)
    setForm(toForm(model))
    setError(null)
    setFormOpen(true)
  }

  const models: Model[] = modelsQuery.data ?? []
  const providers: Provider[] = providersQuery.data ?? []
  const activeProviders = providers.filter((p) => p.status === 'active')

  const availableProviders = (bindingIndex: number) => {
    const used = form.bindings
      .filter((_, i) => i !== bindingIndex)
      .map((b) => b.providerId)
      .concat(form.providerId)
      .filter(Boolean)
    return activeProviders.filter((p) => !used.includes(p.id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">模型目录</h1>
          <p className="text-sm text-muted-foreground">
            维护可用模型、计费倍率与能力标签，支持多渠道绑定与优先级管理
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={openImport}>
              官方预设导入
            </Button>
            <Button onClick={openCreate}>添加模型</Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>模型列表</CardTitle>
        </CardHeader>
        <CardContent>
          {modelsQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">加载中…</div>
          ) : models.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              暂无模型，点击右上角添加。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">模型标识</th>
                    <th className="py-2 pr-4 font-medium">展示名</th>
                    <th className="py-2 pr-4 font-medium">渠道</th>
                    <th className="py-2 pr-4 font-medium">倍率</th>
                    <th className="py-2 pr-4 font-medium">能力标签</th>
                    <th className="py-2 pr-4 font-medium">状态</th>
                    {isAdmin && <th className="py-2 font-medium">操作</th>}
                  </tr>
                </thead>
                <tbody>
                  {models.map((model) => {
                    const bindings = model.providerBindings ?? []
                    const sorted = [...bindings].sort((a, b) => a.priority - b.priority)

                    return (
                      <tr key={model.id} className="border-b last:border-0">
                        <td className="py-2 pr-4">
                          <code className="text-xs">{model.modelId}</code>
                        </td>
                        <td className="py-2 pr-4">
                          {model.displayName || (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {sorted.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {sorted.map((b) => {
                                const isPrimary = b.providerId === model.providerId
                                return (
                                  <span
                                    key={b.providerId}
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                      isPrimary
                                        ? 'bg-primary/10 text-primary'
                                        : 'bg-muted text-muted-foreground'
                                    }`}
                                  >
                                    {b.providerName}
                                    <span className="ml-1 opacity-60">
                                      [P{b.priority}]
                                    </span>
                                  </span>
                                )
                              })}
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-4">×{model.multiplier}</td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {model.capabilities.length > 0
                            ? model.capabilities.join(', ')
                            : '—'}
                        </td>
                        <td className="py-2 pr-4">
                          {model.status === 'active' ? (
                            <span className="text-green-600">正常</span>
                          ) : (
                            <span className="text-muted-foreground">已禁用</span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="py-2">
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEdit(model)}
                              >
                                编辑
                              </Button>
                              {model.status === 'active' ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setConfirm({ model, kind: 'disable' })
                                    }
                                  >
                                    禁用
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive"
                                    onClick={() =>
                                      setConfirm({ model, kind: 'delete' })
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
                                    onClick={() => enableMutation.mutate(model.id)}
                                  >
                                    启用
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive"
                                    onClick={() =>
                                      setConfirm({ model, kind: 'delete' })
                                    }
                                  >
                                    删除
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? '编辑模型' : '添加模型'}</SheetTitle>
            <SheetDescription>
              模型标识在团队内唯一；可绑定多个渠道并设置优先级（数字越小优先级越高）
            </SheetDescription>
          </SheetHeader>
          <form
            className="flex flex-1 flex-col gap-4 overflow-y-auto"
            onSubmit={handleSubmit}
          >
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                主渠道
              </label>
              <Select
                value={form.providerId}
                onValueChange={(v) => setForm({ ...form, providerId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择主渠道" />
                </SelectTrigger>
                <SelectContent>
                  {activeProviders.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Extra channel bindings */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm text-muted-foreground">
                  额外渠道绑定
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addBinding}
                >
                  + 添加渠道
                </Button>
              </div>
              {form.bindings.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  可不填；仅当模型可通过多个渠道访问时添加
                </p>
              )}
              {form.bindings.map((binding, i) => (
                <div key={i} className="mb-2 flex items-center gap-2 rounded-md border border-border p-2">
                  <div className="flex-1">
                    <Select
                      value={binding.providerId}
                      onValueChange={(v) => updateBinding(i, 'providerId', v)}
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="选择渠道" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableProviders(i).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-20">
                    <Input
                      type="number"
                      min={0}
                      placeholder="优先级"
                      value={binding.priority}
                      onChange={(e) => updateBinding(i, 'priority', e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive shrink-0"
                    onClick={() => removeBinding(i)}
                  >
                    移除
                  </Button>
                </div>
              ))}
            </div>

            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                模型标识
              </label>
              <Input
                placeholder="gpt-4o-mini"
                value={form.modelId}
                onChange={(e) => setForm({ ...form, modelId: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                展示名（可选）
              </label>
              <Input
                placeholder="GPT-4o mini"
                value={form.displayName}
                onChange={(e) =>
                  setForm({ ...form, displayName: e.target.value })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                计费倍率
              </label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="1"
                value={form.multiplier}
                onChange={(e) =>
                  setForm({ ...form, multiplier: e.target.value })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                能力标签（逗号分隔）
              </label>
              <Input
                placeholder="chat, code, vision"
                value={form.capabilities}
                onChange={(e) =>
                  setForm({ ...form, capabilities: e.target.value })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                别名（逗号分隔，可选）
              </label>
              <Input
                placeholder="gpt-4o"
                value={form.aliases}
                onChange={(e) => setForm({ ...form, aliases: e.target.value })}
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

      <Sheet open={importOpen} onOpenChange={setImportOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>官方预设导入</SheetTitle>
            <SheetDescription>
              从官方预置目录一键导入模型（能力标签与默认倍率自动填充），需先有对应的上游渠道
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                官方预置
              </label>
              <Select
                value={presetKey}
                onValueChange={(v) => {
                  setPresetKey(v)
                  setSelectedModels([])
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {officialPresets.map((preset) => (
                    <SelectItem key={preset.key} value={preset.key}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                目标渠道
              </label>
              <Select
                value={importProviderId}
                onValueChange={(v) => setImportProviderId(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择渠道" />
                </SelectTrigger>
                <SelectContent>
                  {activeProviders.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              {(activePreset?.models ?? []).map((model) => (
                <label
                  key={model.modelId}
                  className="flex items-start gap-2 rounded-md border border-border p-2 text-sm"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selectedModels.includes(model.modelId)}
                    onChange={() => toggleModel(model.modelId)}
                  />
                  <span>
                    <code className="text-xs">{model.modelId}</code>
                    <span className="ml-2 text-muted-foreground">
                      {model.displayName} · ×{model.multiplier}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {model.capabilities.join(', ')}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            {importResult && (
              <p className="text-sm text-muted-foreground">{importResult}</p>
            )}

            <SheetFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setImportOpen(false)}
              >
                取消
              </Button>
              <Button
                disabled={
                  importMutation.isPending ||
                  !importProviderId ||
                  selectedModels.length === 0
                }
                onClick={() => importMutation.mutate()}
              >
                {importMutation.isPending ? '导入中…' : '导入所选模型'}
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === 'disable' ? '禁用模型' : '删除模型'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === 'disable'
                ? `确定要禁用模型「${confirm.model.modelId}」吗？可随时重新启用。`
                : `确定要删除模型「${confirm?.model.modelId}」吗？此操作不可恢复。`}
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
                  disableMutation.mutate(confirm.model.id)
                } else {
                  deleteMutation.mutate(confirm.model.id)
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