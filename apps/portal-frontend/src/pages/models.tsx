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
  listModels,
  listOfficialPresets,
  removeModel,
  updateModel,
} from '@/features/models/api'
import type { Model, ModelInput, ModelPatch } from '@/features/models/types'
import { listProviders } from '@/features/providers/api'
import type { Provider, ProviderType } from '@/features/providers/types'
import { ApiError } from '@/lib/http'

interface FormState {
  providerId: string
  modelId: string
  displayName: string
  multiplier: string
  capabilities: string
  aliases: string
}

const emptyForm: FormState = {
  providerId: '',
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
  return {
    providerId: model.providerId,
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
  const [removeTarget, setRemoveTarget] = useState<Model | null>(null)

  const [importOpen, setImportOpen] = useState(false)
  const [presetType, setPresetType] = useState<ProviderType>('openai-compatible')
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
  const activePreset = officialPresets.find((p) => p.type === presetType)

  const toggleModel = (modelId: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId],
    )
  }

  const openImport = () => {
    setPresetType('openai-compatible')
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

  const submitMutation = useMutation({
    mutationFn: () => {
      const capabilities = parseList(form.capabilities)
      const aliases = parseList(form.aliases)
      if (editing) {
        const patch: ModelPatch = {
          providerId: form.providerId,
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

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeModel(id),
    onSuccess: () => {
      invalidate()
      setRemoveTarget(null)
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">模型目录</h1>
          <p className="text-sm text-muted-foreground">
            维护可用模型、计费倍率与能力标签，供计量、计费与选型建议使用
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
                    <th className="py-2 pr-4 font-medium">倍率</th>
                    <th className="py-2 pr-4 font-medium">能力标签</th>
                    <th className="py-2 pr-4 font-medium">状态</th>
                    {isAdmin && <th className="py-2 font-medium">操作</th>}
                  </tr>
                </thead>
                <tbody>
                  {models.map((model) => (
                    <tr key={model.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        <code className="text-xs">{model.modelId}</code>
                      </td>
                      <td className="py-2 pr-4">
                        {model.displayName || (
                          <span className="text-muted-foreground">—</span>
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
                            {model.status === 'active' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRemoveTarget(model)}
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
            <SheetTitle>{editing ? '编辑模型' : '添加模型'}</SheetTitle>
            <SheetDescription>
              模型标识在团队内唯一；倍率用于计费（倍率 × token）
            </SheetDescription>
          </SheetHeader>
          <form
            className="flex flex-1 flex-col gap-4 overflow-y-auto"
            onSubmit={handleSubmit}
          >
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                归属渠道
              </label>
              <Select
                value={form.providerId}
                onValueChange={(v) => setForm({ ...form, providerId: v })}
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
              从官方预置目录一键导入模型（能力标签与默认倍率自动填充），需先有对应协议类型的上游渠道
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                官方协议类型
              </label>
              <Select
                value={presetType}
                onValueChange={(v) => {
                  setPresetType(v as ProviderType)
                  setSelectedModels([])
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {officialPresets.map((preset) => (
                    <SelectItem key={preset.type} value={preset.type}>
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
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除模型</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除模型「{removeTarget?.modelId}」吗？
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
