import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getCurrency, updateCurrency } from '@/features/system/api'
import type { CurrencyConfig, CurrencyRate } from '@/features/system/types'

interface RateDraft {
  code: string
  name: string
  pointsPerUnit: string
}

const emptyDraft: RateDraft = { code: '', name: '', pointsPerUnit: '' }

function toDraft(rate: CurrencyRate): RateDraft {
  return {
    code: rate.code,
    name: rate.name,
    pointsPerUnit: String(rate.pointsPerUnit),
  }
}

function CurrencyEditorForm({
  config,
  pending,
  serverError,
  onSave,
}: {
  config: CurrencyConfig | null
  pending: boolean
  serverError: string | null
  onSave: (config: CurrencyConfig) => void
}) {
  const [rates, setRates] = useState<RateDraft[]>(() =>
    config ? config.rates.map(toDraft) : [],
  )
  const [displayCurrency, setDisplayCurrency] = useState(
    config?.displayCurrency ?? '',
  )
  const [localError, setLocalError] = useState<string | null>(null)

  const updateRate = (index: number, patch: Partial<RateDraft>) => {
    setRates((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const addRate = () => {
    setRates((rs) => [...rs, { ...emptyDraft }])
  }

  const removeRate = (index: number) => {
    setRates((rs) => rs.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    const parsed: CurrencyRate[] = []
    const codes = new Set<string>()
    for (const r of rates) {
      const code = r.code.trim()
      const name = r.name.trim()
      const pointsPerUnit = Number(r.pointsPerUnit)
      if (!code || !name) {
        setLocalError('币种代码与名称不能为空')
        return
      }
      if (!Number.isFinite(pointsPerUnit) || pointsPerUnit <= 0) {
        setLocalError(`「${code}」的每单位点数必须大于 0`)
        return
      }
      if (codes.has(code)) {
        setLocalError(`币种代码「${code}」重复`)
        return
      }
      codes.add(code)
      parsed.push({ code, name, pointsPerUnit })
    }
    if (parsed.length === 0) {
      setLocalError('至少添加一个币种')
      return
    }
    if (!codes.has(displayCurrency)) {
      setLocalError('默认展示货币必须存在于币种列表中')
      return
    }

    onSave({ displayCurrency, rates: parsed })
  }

  const displayOptions = rates.map((r) => r.code.trim()).filter(Boolean)
  const error = localError ?? serverError

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        {rates.length === 0 ? (
          <div className="py-3 text-sm text-muted-foreground">
            暂无币种，点击下方「添加币种」
          </div>
        ) : (
          rates.map((rate, index) => (
            <div
              key={index}
              className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <Input
                placeholder="币种代码（如 USD）"
                value={rate.code}
                onChange={(e) => updateRate(index, { code: e.target.value })}
              />
              <Input
                placeholder="名称（如 美元）"
                value={rate.name}
                onChange={(e) => updateRate(index, { name: e.target.value })}
              />
              <Input
                type="number"
                step="any"
                placeholder="每单位点数"
                value={rate.pointsPerUnit}
                onChange={(e) =>
                  updateRate(index, { pointsPerUnit: e.target.value })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="删除币种"
                onClick={() => removeRate(index)}
              >
                <Trash2 />
              </Button>
            </div>
          ))
        )}
        <Button type="button" variant="outline" size="sm" onClick={addRate}>
          <Plus /> 添加币种
        </Button>
      </div>

      <div className="max-w-xs">
        <label className="mb-1 block text-sm text-muted-foreground">
          默认展示货币
        </label>
        <Select value={displayCurrency} onValueChange={setDisplayCurrency}>
          <SelectTrigger>
            <SelectValue placeholder="选择默认货币" />
          </SelectTrigger>
          <SelectContent>
            {displayOptions.map((code) => (
              <SelectItem key={code} value={code}>
                {code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          保存
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </form>
  )
}

export function CurrencySettingsCard() {
  const queryClient = useQueryClient()
  const currencyQuery = useQuery({
    queryKey: ['system', 'currency'],
    queryFn: getCurrency,
  })

  const [message, setMessage] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: updateCurrency,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system', 'currency'] })
      setMessage('已保存')
      setServerError(null)
    },
    onError: (err: Error) => setServerError(err.message),
  })

  const config = currencyQuery.data ?? null

  return (
    <Card>
      <CardHeader>
        <CardTitle>货币汇率</CardTitle>
        <CardDescription>
          配置点数与货币的换算（1 货币单位 = 每单位点数），用于余额与成本展示
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {currencyQuery.isLoading ? (
          <div className="py-6 text-sm text-muted-foreground">加载中…</div>
        ) : (
          <CurrencyEditorForm
            key={config ? JSON.stringify(config) : 'unconfigured'}
            config={config}
            pending={mutation.isPending}
            serverError={serverError}
            onSave={(c) => mutation.mutate(c)}
          />
        )}
        {message && <p className="text-sm text-green-600">{message}</p>}
      </CardContent>
    </Card>
  )
}
