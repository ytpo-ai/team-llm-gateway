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
import { listSettings, updateSettings } from '@/features/system/api'
import type { SystemSetting } from '@/features/system/types'

interface FieldDefinition {
  key: string
  label: string
  type: 'text' | 'number'
  placeholder?: string
}

const FIELD_DEFINITIONS: FieldDefinition[] = [
  {
    key: 'notification.quotaThreshold',
    label: '额度余额告警阈值',
    type: 'number',
    placeholder: '如 80（成员余额低于该值时告警）',
  },
  {
    key: 'notification.lowBalanceEmail',
    label: '余额告警通知邮箱',
    type: 'text',
    placeholder: '如 admin@example.com',
  },
  {
    key: 'audit.retentionDays',
    label: '审计日志保留天数',
    type: 'number',
    placeholder: '如 90',
  },
  {
    key: 'gateway.defaultModel',
    label: '默认模型',
    type: 'text',
    placeholder: '如 gpt-4o-mini',
  },
]

function valueToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function SettingsPage() {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const settingsQuery = useQuery({
    queryKey: ['system', 'settings'],
    queryFn: listSettings,
  })

  const settings: SystemSetting[] = settingsQuery.data ?? []
  const knownKeys = new Set(FIELD_DEFINITIONS.map((f) => f.key))
  const otherSettings = settings.filter((s) => !knownKeys.has(s.key))

  const currentValue = (key: string): string => {
    if (key in values) return values[key]
    const existing = settings.find((s) => s.key === key)
    return existing ? valueToString(existing.value) : ''
  }

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system', 'settings'] })
      setValues({})
      setMessage('已保存')
      setError(null)
    },
    onError: (err: Error) => setError(err.message),
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setError(null)

    const payload: Record<string, unknown> = {}
    for (const field of FIELD_DEFINITIONS) {
      const raw = currentValue(field.key).trim()
      if (raw === '') continue
      if (field.type === 'number') {
        const num = Number(raw)
        if (!Number.isFinite(num)) {
          setError(`「${field.label}」需为数字`)
          return
        }
        payload[field.key] = num
      } else {
        payload[field.key] = raw
      }
    }
    mutation.mutate(payload)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">系统设置</h1>
        <p className="text-sm text-muted-foreground">
          租户级系统配置（仅 team_admin 可读写）
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>通知与审计</CardTitle>
          <CardDescription>配置额度告警、通知邮箱与审计保留策略</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELD_DEFINITIONS.map((field) => (
                <label key={field.key} className="space-y-1.5 text-sm">
                  <span className="font-medium">{field.label}</span>
                  <Input
                    type={field.type === 'number' ? 'number' : 'text'}
                    step={field.type === 'number' ? 'any' : undefined}
                    placeholder={field.placeholder}
                    value={currentValue(field.key)}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [field.key]: e.target.value }))
                    }
                  />
                </label>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={mutation.isPending}>
                保存
              </Button>
              {message && <p className="text-sm text-green-600">{message}</p>}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>其他配置</CardTitle>
          <CardDescription>系统中已有的其它配置项（只读展示）</CardDescription>
        </CardHeader>
        <CardContent>
          {settingsQuery.isLoading ? (
            <div className="py-6 text-sm text-muted-foreground">加载中…</div>
          ) : otherSettings.length === 0 ? (
            <div className="py-6 text-sm text-muted-foreground">暂无其它配置</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">键</th>
                  <th className="py-2 pr-4 font-medium">值</th>
                  <th className="py-2 text-right font-medium">更新时间</th>
                </tr>
              </thead>
              <tbody>
                {otherSettings.map((item) => (
                  <tr key={item.key} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <code className="text-xs">{item.key}</code>
                    </td>
                    <td className="py-2 pr-4">{valueToString(item.value)}</td>
                    <td className="py-2 text-right text-muted-foreground">
                      {item.updatedAt
                        ? new Date(item.updatedAt).toLocaleString()
                        : '—'}
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
