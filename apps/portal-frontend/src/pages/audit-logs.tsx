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
import { listAuditLogs } from '@/features/system/api'
import type { AuditAction, AuditResourceType } from '@/features/system/types'

const PAGE_SIZE = 50

const ACTION_LABELS: Record<AuditAction, string> = {
  create: '创建',
  update: '更新',
  disable: '禁用',
  revoke: '吊销',
  rotate: '轮换',
  recharge: '充值',
  adjust: '调整',
  invite: '邀请',
  invite_revoke: '撤销邀请',
  member_update: '成员变更',
  member_remove: '移除成员',
}

const RESOURCE_LABELS: Record<AuditResourceType, string> = {
  billing: '额度',
  api_key: 'API Key',
  model: '模型',
  provider: '上游',
  team: '团队',
  member: '成员',
  invitation: '邀请',
}

const ACTION_OPTIONS = Object.keys(ACTION_LABELS) as AuditAction[]
const RESOURCE_OPTIONS = Object.keys(RESOURCE_LABELS) as AuditResourceType[]

function fmtDate(value?: string): string {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

interface Filters {
  action: string
  resourceType: string
  userId: string
  from: string
  to: string
}

const emptyFilters: Filters = {
  action: '',
  resourceType: '',
  userId: '',
  from: '',
  to: '',
}

export function AuditLogsPage() {
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [offset, setOffset] = useState(0)

  const query = useQuery({
    queryKey: ['system', 'audit-logs', filters, offset],
    queryFn: () =>
      listAuditLogs({
        action: (filters.action || undefined) as AuditAction | undefined,
        resourceType: (filters.resourceType || undefined) as
          | AuditResourceType
          | undefined,
        userId: filters.userId || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
    placeholderData: keepPreviousData,
  })

  const data = query.data
  const total = data?.total ?? 0
  const hasPrev = offset > 0
  const hasNext = offset + PAGE_SIZE < total

  const setFilter = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setOffset(0)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">审计日志</h1>
        <p className="text-sm text-muted-foreground">
          关键操作审计记录（仅 team_admin 可读）
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>筛选</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <select
              value={filters.action}
              onChange={(e) => setFilter({ action: e.target.value })}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">全部动作</option>
              {ACTION_OPTIONS.map((action) => (
                <option key={action} value={action}>
                  {ACTION_LABELS[action]}
                </option>
              ))}
            </select>
            <select
              value={filters.resourceType}
              onChange={(e) => setFilter({ resourceType: e.target.value })}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">全部资源</option>
              {RESOURCE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {RESOURCE_LABELS[type]}
                </option>
              ))}
            </select>
            <Input
              placeholder="操作人 ID"
              value={filters.userId}
              onChange={(e) => setFilter({ userId: e.target.value })}
              className="w-56"
            />
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
          <CardTitle>日志列表</CardTitle>
          <CardDescription>共 {total} 条</CardDescription>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <div className="py-6 text-sm text-muted-foreground">加载中…</div>
          ) : (data?.items.length ?? 0) === 0 ? (
            <div className="py-6 text-sm text-muted-foreground">暂无审计记录</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">时间</th>
                  <th className="py-2 pr-4 font-medium">动作</th>
                  <th className="py-2 pr-4 font-medium">资源</th>
                  <th className="py-2 pr-4 font-medium">资源 ID</th>
                  <th className="py-2 pr-4 font-medium">摘要</th>
                  <th className="py-2 pr-4 font-medium">操作人</th>
                  <th className="py-2 text-right font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {fmtDate(item.createdAt)}
                    </td>
                    <td className="py-2 pr-4">{ACTION_LABELS[item.action]}</td>
                    <td className="py-2 pr-4">{RESOURCE_LABELS[item.resourceType]}</td>
                    <td className="py-2 pr-4">
                      <code className="text-xs">{item.resourceId ?? '—'}</code>
                    </td>
                    <td className="py-2 pr-4">{item.summary ?? '—'}</td>
                    <td className="py-2 pr-4">
                      <code className="text-xs">{item.userId}</code>
                    </td>
                    <td className="py-2 text-right">{item.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              第 {Math.floor(offset / PAGE_SIZE) + 1} 页
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!hasPrev}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNext}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
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
