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
import { ModelCard } from '@/features/models/components/model-card'
import { formatTokenCount } from '@/features/models/utils'
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
  description: string
  contextLength: string
  maxOutputLength: string
  inputModalities: string[]
  outputModalities: string[]
  multiplier: string
  capabilities: string
  aliases: string
}

const MODALITY_OPTIONS = [
  { value: 'text', label: '文本' },
  { value: 'image', label: '图片' },
  { value: 'audio', label: '音频' },
  { value: 'video', label: '视频' },
] as const

const emptyBinding: BindingFormEntry = { providerId: '', priority: '0' }

const emptyForm: FormState = {
  providerId: '',
  bindings: [],
  modelId: '',
  displayName: '',
  description: '',
  contextLength: '',
  maxOutputLength: '',
  inputModalities: ['text'],
  outputModalities: ['text'],
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
    description: model.description ?? '',
    contextLength: model.contextLength != null ? String(model.contextLength) : '',
    maxOutputLength:
      model.maxOutputLength != null ? String(model.maxOutputLength) : '',
    inputModalities:
      model.inputModalities?.length > 0 ? model.inputModalities : ['text'],
    outputModalities:
      model.outputModalities?.length > 0 ? model.outputModalities : ['text'],
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
          description: m.description,
          contextLength: m.contextLength,
          maxOutputLength: m.maxOutputLength,
          inputModalities: m.inputModalities,
          outputModalities: m.outputModalities,
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

  const toggleModality = (
    field: 'inputModalities' | 'outputModalities',
    value: string,
  ) => {
    const current = form[field]
    setForm({
      ...form,
      [field]: current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value],
    })
  }

  const submitMutation = useMutation({
    mutationFn: () => {
      const capabilities = parseList(form.capabilities)
      const aliases = parseList(form.aliases)
      const providerBindings = buildProviderBindings()
      const contextLength = form.contextLength
        ? Number(form.contextLength)
        : undefined
      const maxOutputLength = form.maxOutputLength
        ? Number(form.maxOutputLength)
        : undefined

      if (editing) {
        const patch: ModelPatch = {
          providerId: form.providerId,
          providerBindings,
          modelId: form.modelId.trim(),
          displayName: form.displayName.trim(),
          description: form.description.trim(),
          contextLength,
          maxOutputLength,
          inputModalities: form.inputModalities,
          outputModalities: form.outputModalities,
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
        description: form.description.trim() || undefined,
        contextLength,
        maxOutputLength,
        inputModalities: form.inputModalities,
        outputModalities: form.outputModalities,
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

      {modelsQuery.isLoading ? (
        <div className="text-sm text-muted-foreground">加载中…</div>
      ) : modelsQuery.isError ? (
        <div className="flex items-center gap-2 text-sm text-red-500">
          {modelsQuery.error instanceof ApiError
            ? modelsQuery.error.message
            : '加载失败，请稍后重试'}
          <Button
            variant="outline"
            size="sm"
            onClick={() => modelsQuery.refetch()}
          >
            重试
          </Button>
        </div>
      ) : models.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          暂无模型，点击右上角添加。
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {models.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              isAdmin={isAdmin}
              onEdit={startEdit}
              onDisable={(m) => setConfirm({ model: m, kind: 'disable' })}
              onEnable={(m) => enableMutation.mutate(m.id)}
              onDelete={(m) => setConfirm({ model: m, kind: 'delete' })}
            />
          ))}
        </div>
      )}

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
                简介（可选）
              </label>
              <Input
                placeholder="模型能力与适用场景的简要介绍"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">
                  上下文长度（tokens）
                </label>
                <Input
                  type="number"
                  min={1}
                  placeholder="128000"
                  value={form.contextLength}
                  onChange={(e) =>
                    setForm({ ...form, contextLength: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">
                  最大输出（tokens）
                </label>
                <Input
                  type="number"
                  min={1}
                  placeholder="16384"
                  value={form.maxOutputLength}
                  onChange={(e) =>
                    setForm({ ...form, maxOutputLength: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                输入模态
              </label>
              <div className="flex flex-wrap gap-3">
                {MODALITY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-1.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={form.inputModalities.includes(option.value)}
                      onChange={() =>
                        toggleModality('inputModalities', option.value)
                      }
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                输出模态
              </label>
              <div className="flex flex-wrap gap-3">
                {MODALITY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-1.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={form.outputModalities.includes(option.value)}
                      onChange={() =>
                        toggleModality('outputModalities', option.value)
                      }
                    />
                    {option.label}
                  </label>
                ))}
              </div>
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
                      {model.displayName} · ×{model.multiplier} ·{' '}
                      {formatTokenCount(model.contextLength)} 上下文
                    </span>
                    {model.description && (
                      <span className="block text-xs text-muted-foreground">
                        {model.description}
                      </span>
                    )}
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