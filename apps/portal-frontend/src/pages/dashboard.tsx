import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  getUsageByKey,
  getUsageByMember,
  getUsageByModel,
  getUsageByProvider,
  getUsageSummary,
  getUsageTrends,
} from '@/features/usage/api'
import type {
  UsageBreakdownItem,
  UsageGranularity,
  UsageTrendPoint,
} from '@/features/usage/types'

const fmtInt = new Intl.NumberFormat('zh-CN')
const fmtCost = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 })

function formatBucket(bucket: string, granularity: UsageGranularity): string {
  const d = new Date(bucket)
  const md = `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}`
  if (granularity === 'hour') {
    return `${md} ${String(d.getHours()).padStart(2, '0')}时`
  }
  return md
}

function TrendChart({
  data,
  granularity,
}: {
  data: UsageTrendPoint[]
  granularity: UsageGranularity
}) {
  if (data.length === 0) {
    return <div className="py-10 text-sm text-muted-foreground">暂无趋势数据</div>
  }

  const width = 720
  const height = 200
  const max = Math.max(...data.map((d) => d.totalTokens), 1)
  const barWidth = width / data.length

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full">
      {data.map((d, i) => {
        const h = Math.max((d.totalTokens / max) * (height - 12), d.totalTokens > 0 ? 2 : 0)
        const x = i * barWidth
        const y = height - h
        return (
          <g key={d.bucket}>
            <rect
              x={x + 1}
              y={y}
              width={Math.max(barWidth - 2, 1)}
              height={h}
              rx={1}
              className="fill-primary/60"
            >
              <title>
                {formatBucket(d.bucket, granularity)}：{fmtInt.format(d.totalTokens)} tokens / 成本{' '}
                {fmtCost.format(d.totalCost)}
              </title>
            </rect>
          </g>
        )
      })}
    </svg>
  )
}

const fmtPercent = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 })

function BreakdownTable({ items }: { items: UsageBreakdownItem[] }) {
  const totals = useMemo(() => {
    let requestCount = 0
    let totalTokens = 0
    let totalCost = 0
    for (const item of items) {
      requestCount += item.requestCount
      totalTokens += item.totalTokens
      totalCost += item.totalCost
    }
    return { requestCount, totalTokens, totalCost }
  }, [items])

  if (items.length === 0) {
    return <div className="py-6 text-sm text-muted-foreground">暂无数据</div>
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-2 pr-4 font-medium">名称</th>
          <th className="py-2 pr-4 text-right font-medium">请求数</th>
          <th className="py-2 pr-4 text-right font-medium">Token</th>
          <th className="py-2 text-right font-medium">成本</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const reqPct = totals.requestCount > 0
            ? (item.requestCount / totals.requestCount) * 100
            : 0
          const tokenPct = totals.totalTokens > 0
            ? (item.totalTokens / totals.totalTokens) * 100
            : 0
          const costPct = totals.totalCost > 0
            ? (item.totalCost / totals.totalCost) * 100
            : 0
          return (
            <tr key={item.id} className="border-b last:border-0">
              <td className="py-2 pr-4">{item.label ?? item.id}</td>
              <td className="py-2 pr-4 text-right">
                {fmtInt.format(item.requestCount)}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({fmtPercent.format(reqPct)}%)
                </span>
              </td>
              <td className="py-2 pr-4 text-right">
                {fmtInt.format(item.totalTokens)}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({fmtPercent.format(tokenPct)}%)
                </span>
              </td>
              <td className="py-2 text-right">
                {fmtCost.format(item.totalCost)}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({fmtPercent.format(costPct)}%)
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

const RANGE_OPTIONS = [
  { days: 7, label: '近 7 天' },
  { days: 30, label: '近 30 天' },
  { days: 90, label: '近 90 天' },
]

export function DashboardPage() {
  const [now] = useState(() => new Date())
  const [rangeDays, setRangeDays] = useState(30)
  const [granularity, setGranularity] = useState<UsageGranularity>('day')

  const range = useMemo(() => {
    const to = new Date(now)
    const from = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000)
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      granularity,
    }
  }, [now, rangeDays, granularity])

  const summaryQuery = useQuery({
    queryKey: ['usage', 'summary', range],
    queryFn: () => getUsageSummary(range),
  })
  const trendsQuery = useQuery({
    queryKey: ['usage', 'trends', range],
    queryFn: () => getUsageTrends(range),
  })
  const byModelQuery = useQuery({
    queryKey: ['usage', 'by-model', range],
    queryFn: () => getUsageByModel(range),
  })
  const byMemberQuery = useQuery({
    queryKey: ['usage', 'by-member', range],
    queryFn: () => getUsageByMember(range),
  })
  const byKeyQuery = useQuery({
    queryKey: ['usage', 'by-key', range],
    queryFn: () => getUsageByKey(range),
  })
  const byProviderQuery = useQuery({
    queryKey: ['usage', 'by-provider', range],
    queryFn: () => getUsageByProvider(range),
  })

  const summary = summaryQuery.data
  const trends: UsageTrendPoint[] = trendsQuery.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">用量看板</h1>
          <p className="text-sm text-muted-foreground">
            Token 计量与成本（成本 = 模型倍率 × Token）
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {RANGE_OPTIONS.map((opt) => (
              <Button
                key={opt.days}
                variant={rangeDays === opt.days ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRangeDays(opt.days)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-1">
            <Button
              variant={granularity === 'day' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setGranularity('day')}
            >
              按天
            </Button>
            <Button
              variant={granularity === 'hour' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setGranularity('hour')}
            >
              按小时
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>请求数</CardDescription>
            <CardTitle className="text-2xl">
              {summaryQuery.isLoading ? '…' : fmtInt.format(summary?.requestCount ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>总 Token</CardDescription>
            <CardTitle className="text-2xl">
              {summaryQuery.isLoading ? '…' : fmtInt.format(summary?.totalTokens ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>输入 / 输出 Token</CardDescription>
            <CardTitle className="text-lg">
              {summaryQuery.isLoading
                ? '…'
                : `${fmtInt.format(summary?.promptTokens ?? 0)} / ${fmtInt.format(summary?.completionTokens ?? 0)}`}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>总成本（额度）</CardDescription>
            <CardTitle className="text-2xl">
              {summaryQuery.isLoading ? '…' : fmtCost.format(summary?.totalCost ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>用量趋势</CardTitle>
          <CardDescription>所选时间范围内的 Token 用量分布</CardDescription>
        </CardHeader>
        <CardContent>
          {trendsQuery.isLoading ? (
            <div className="py-10 text-sm text-muted-foreground">加载中…</div>
          ) : (
            <TrendChart data={trends} granularity={granularity} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>按模型</CardTitle>
          </CardHeader>
          <CardContent>
            {byModelQuery.isLoading ? (
              <div className="py-6 text-sm text-muted-foreground">加载中…</div>
            ) : (
              <BreakdownTable items={byModelQuery.data ?? []} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>按渠道</CardTitle>
          </CardHeader>
          <CardContent>
            {byProviderQuery.isLoading ? (
              <div className="py-6 text-sm text-muted-foreground">加载中…</div>
            ) : (
              <BreakdownTable items={byProviderQuery.data ?? []} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>按成员</CardTitle>
          </CardHeader>
          <CardContent>
            {byMemberQuery.isLoading ? (
              <div className="py-6 text-sm text-muted-foreground">加载中…</div>
            ) : (
              <BreakdownTable items={byMemberQuery.data ?? []} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>按 API Key</CardTitle>
          </CardHeader>
          <CardContent>
            {byKeyQuery.isLoading ? (
              <div className="py-6 text-sm text-muted-foreground">加载中…</div>
            ) : (
              <BreakdownTable items={byKeyQuery.data ?? []} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
