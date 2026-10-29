import { useQuery } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getOverview, getUsageBreakdown } from '@/features/admin/api'
import type { AdminOverview, TenantUsageItem } from '@/features/admin/types'

const fmtNum = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 })

function StatCard({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

function fmtDate(value?: string): string {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

function UsageTable({ items }: { items: TenantUsageItem[] }) {
  if (items.length === 0) {
    return <div className="py-6 text-sm text-muted-foreground">暂无用量数据</div>
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-2 pr-4 font-medium">租户</th>
          <th className="py-2 pr-4 text-right font-medium">请求数</th>
          <th className="py-2 pr-4 text-right font-medium">Token</th>
          <th className="py-2 text-right font-medium">成本</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.tenantId} className="border-b last:border-0">
            <td className="py-2 pr-4">{item.name}</td>
            <td className="py-2 pr-4 text-right">
              {fmtNum.format(item.requestCount)}
            </td>
            <td className="py-2 pr-4 text-right">
              {fmtNum.format(item.totalTokens)}
            </td>
            <td className="py-2 text-right">{fmtNum.format(item.totalCost)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function AdminOverviewPage() {
  const overviewQuery = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: getOverview,
  })
  const usageQuery = useQuery({
    queryKey: ['admin', 'overview', 'usage'],
    queryFn: getUsageBreakdown,
  })

  const overview: AdminOverview | undefined = overviewQuery.data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">全局看板</h1>
        <p className="text-sm text-muted-foreground">
          服务商全局视角（近 30 天用量，仅 system 角色可见）
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="租户数"
          value={overviewQuery.isLoading ? '…' : (overview?.tenantCount ?? 0)}
        />
        <StatCard
          label="团队数"
          value={overviewQuery.isLoading ? '…' : (overview?.teamCount ?? 0)}
        />
        <StatCard
          label="成员数"
          value={overviewQuery.isLoading ? '…' : (overview?.memberCount ?? 0)}
        />
        <StatCard
          label="API Key 数"
          value={overviewQuery.isLoading ? '…' : (overview?.apiKeyCount ?? 0)}
        />
        <StatCard
          label="请求数（近 30 天）"
          value={overviewQuery.isLoading ? '…' : (overview?.requestCount ?? 0)}
        />
        <StatCard
          label="Token 用量（近 30 天）"
          value={
            overviewQuery.isLoading
              ? '…'
              : fmtNum.format(overview?.totalTokens ?? 0)
          }
        />
        <StatCard
          label="总成本（近 30 天）"
          value={
            overviewQuery.isLoading
              ? '…'
              : fmtNum.format(overview?.totalCost ?? 0)
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>按租户用量</CardTitle>
          <CardDescription>
            {usageQuery.data
              ? `${fmtDate(usageQuery.data.from)} ~ ${fmtDate(usageQuery.data.to)}`
              : '近 30 天'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usageQuery.isLoading ? (
            <div className="py-6 text-sm text-muted-foreground">加载中…</div>
          ) : (
            <UsageTable items={usageQuery.data?.items ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
