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

const selectClass =
  'h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

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

  const [form, setForm] = useState<FormState>(emptyForm)
  const [editing, setEditing] = useState<Model | null>(null)
  const [error, setError] = useState<string | null>(null)

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
      invalidate()
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : '操作失败，请稍后重试')
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeModel(id),
    onSuccess: invalidate,
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
  }

  const models: Model[] = modelsQuery.data ?? []
  const providers: Provider[] = providersQuery.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">模型目录</h1>
        <p className="text-sm text-muted-foreground">
          维护可用模型、计费倍率与能力标签，供计量、计费与选型建议使用
        </p>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? '编辑模型' : '添加模型'}</CardTitle>
            <CardDescription>
              模型标识在团队内唯一；倍率用于计费（倍率 × token）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">
                  归属渠道
                </label>
                <select
                  className={`${selectClass} w-full`}
                  value={form.providerId}
                  onChange={(e) =>
                    setForm({ ...form, providerId: e.target.value })
                  }
                  required
                >
                  <option value="" disabled>
                    请选择渠道
                  </option>
                  {providers
                    .filter((p) => p.status === 'active')
                    .map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                </select>
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
      )}

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>官方预设导入</CardTitle>
            <CardDescription>
              从官方预置目录一键导入模型（能力标签与默认倍率自动填充），需先有对应协议类型的上游渠道
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!importOpen ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setImportOpen(true)}
              >
                打开官方预设导入
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-muted-foreground">
                      官方协议类型
                    </label>
                    <select
                      className={`${selectClass} w-full`}
                      value={presetType}
                      onChange={(e) => {
                        setPresetType(e.target.value as ProviderType)
                        setSelectedModels([])
                      }}
                    >
                      {officialPresets.map((preset) => (
                        <option key={preset.type} value={preset.type}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-muted-foreground">
                      目标渠道
                    </label>
                    <select
                      className={`${selectClass} w-full`}
                      value={importProviderId}
                      onChange={(e) => setImportProviderId(e.target.value)}
                      required
                    >
                      <option value="" disabled>
                        请选择渠道
                      </option>
                      {providers
                        .filter((p) => p.status === 'active')
                        .map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {provider.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
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

                <div className="flex gap-2">
                  <Button
                    type="button"
                    disabled={
                      importMutation.isPending ||
                      !importProviderId ||
                      selectedModels.length === 0
                    }
                    onClick={() => importMutation.mutate()}
                  >
                    {importMutation.isPending ? '导入中…' : '导入所选模型'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setImportOpen(false)
                      setImportResult(null)
                    }}
                  >
                    收起
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>模型列表</CardTitle>
        </CardHeader>
        <CardContent>
          {modelsQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">加载中…</div>
          ) : models.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              暂无模型，点击上方添加。
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
                                disabled={removeMutation.isPending}
                                onClick={() => removeMutation.mutate(model.id)}
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
