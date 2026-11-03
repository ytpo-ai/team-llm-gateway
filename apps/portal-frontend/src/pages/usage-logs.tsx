import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
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
import { getUsageLogs } from '@/features/usage/api'
import type { UsageLogStatus } from '@/features/usage/types'

const PAGE_SIZE = 50

function fmtDate(value?: string): string {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

interface Filters {
  modelId: string
  status: string
  from: string
  to: string
}

const emptyFilters: Filters = {
  modelId: '',
  status: '',
  from: '',
  to: '',
}

export function UsageLogsPage() {
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: ['usage', 'logs', filters, page],
    queryFn: () =>
      getUsageLogs({
        modelId: filters.modelId || undefined,
        status: (filters.status || undefined) as UsageLogStatus | undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  })

  const data = query.data
  const total = data?.total ?? 0
  const hasPrev = page > 1
  const hasNext = page * PAGE_SIZE < total

  const setFilter = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">使用日志</h1>
        <p className="text-sm text-muted-foreground">
          每笔 LLM 调用的 token 与成本明细
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>筛选</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="模型标识"
              value={filters.modelId}
              onChange={(e) => setFilter({ modelId: e.target.value })}
              className="w-56"
            />
            <Select
              value={filters.status}
              onValueChange={(v) => setFilter({ status: v })}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部状态</SelectItem>
                <SelectItem value="success">成功</SelectItem>
                <SelectItem value="error">失败</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="datetime-local"
              value={filters.from}
              onChange={(e) => setFilter({ from: e.target.value })}
              className="w-56"
            />
            <span className="self-center text-sm text-muted-foreground">至</span>
            <Input
              type="datetime-local"
              value={filters.to}
              onChange={(e) => setFilter({ to: e.target.value })}
              className="w-56"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>调用明细</CardTitle>
          <CardDescription>共 {total} 条</CardDescription>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <div className="py-6 text-sm text-muted-foreground">加载中…</div>
          ) : (data?.items.length ?? 0) === 0 ? (
            <div className="py-6 text-sm text-muted-foreground">暂无使用日志</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">时间</th>
                    <th className="py-2 pr-4 font-medium">模型</th>
                    <th className="py-2 pr-4 font-medium">状态</th>
                    <th className="py-2 pr-4 font-medium">输入</th>
                    <th className="py-2 pr-4 font-medium">输出</th>
                    <th className="py-2 pr-4 font-medium">总 Token</th>
                    <th className="py-2 pr-4 font-medium">成本</th>
                    <th className="py-2 pr-4 font-medium">延迟</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {fmtDate(log.createdAt)}
                      </td>
                      <td className="py-2 pr-4">
                        <code className="text-xs">{log.modelId}</code>
                      </td>
                      <td className="py-2 pr-4">
                        {log.status === 'success' ? (
                          <span className="text-green-600">成功</span>
                        ) : (
                          <span className="text-red-500">失败</span>
                        )}
                      </td>
                      <td className="py-2 pr-4">{log.promptTokens.toLocaleString()}</td>
                      <td className="py-2 pr-4">
                        {log.completionTokens.toLocaleString()}
                      </td>
                      <td className="py-2 pr-4">{log.totalTokens.toLocaleString()}</td>
                      <td className="py-2 pr-4">{log.cost.toFixed(4)}</td>
                      <td className="py-2 pr-4">
                        {log.latencyMs != null ? `${log.latencyMs}ms` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">第 {page} 页</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!hasPrev}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNext}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
