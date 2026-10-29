# SYSTEM_ADMIN_REQ-002 开发记录（前端系统设置页 + 审计日志页）

> 对应需求：`docs/requirement/SYSTEM_ADMIN_REQ-002_FRONTEND_SYSTEM.md`
> 对应计划：`docs/plan/SYSTEM_ADMIN_PLAN.md`
> 分支：`main`

## 1. 实现摘要

落地前端系统管理两页：系统设置页（配置表单读写）+ 审计日志页（筛选 + 分页），路由 `/settings`、`/audit-logs` + 导航「设置」「审计」接入，仅 `team_admin` 可见。

- `features/system/`（`types` + `api`）：`SystemSetting`/`AuditLog` 类型与 `GET/PUT /system/settings`、`GET /system/audit-logs` API 封装。
- `pages/settings.tsx`：预定义 4 个配置字段（`notification.quotaThreshold`/`notification.lowBalanceEmail`/`audit.retentionDays`/`gateway.defaultModel`）表单 + 「其他配置」只读列表；number 字段前端校验并转数值，保存后刷新。
- `pages/audit-logs.tsx`：动作/资源类型下拉 + 操作人 ID + 时间范围筛选，表格展示时间/动作/资源/资源 ID/摘要/操作人/IP，`keepPreviousData` 分页（上一页/下一页）。
- 动作与资源类型中文化映射（`ACTION_LABELS`/`RESOURCE_LABELS`）本地实现。
- 路由 + 导航接入，`team_admin` 才渲染「设置」「审计」入口。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `features/system/types.ts` | `SystemSetting`/`AuditLog`/`AuditLogPage` 类型 + 动作/资源类型联合类型 |
| `features/system/api.ts` | `listSettings`/`updateSettings`/`listAuditLogs` API |
| `pages/settings.tsx` | 系统设置页 |
| `pages/audit-logs.tsx` | 审计日志页 |

### 修改

| 文件 | 说明 |
|---|---|
| `router.tsx` | 新增 `/settings`、`/audit-logs` 路由 |
| `components/layout/app-layout.tsx` | 导航接入「设置」「审计」（`team_admin` 可见） |

## 3. 踩坑记录

1. **配置值类型杂糅**：`SystemSetting.value` 为 `unknown`（字符串/数字/对象），表单编辑统一用字符串状态，保存时按字段类型转数值，展示时用 `valueToString`（对象转 JSON）兜底。
2. **筛选触发分页重置**：筛选条件变更时需同时 `setOffset(0)`，否则会停留在旧页码；用 `keepPreviousData` 保证切换期间不闪屏。
3. **无 select/label 组件**：下拉复用原生 `<select>`，表单字段用 `label` + `Input` 手绘，与既有 `billing.tsx`/`models.tsx` 风格一致。

## 4. 验证结果

- `pnpm --filter portal-frontend typecheck`：通过。
- `pnpm --filter portal-frontend lint`：0 errors（1 条既有 warning，非本模块）。
- `pnpm --filter portal-frontend build`：通过。

## 5. 关联

- feature：`docs/feature/system_admin.md`
- 上游：`docs/plan/SYSTEM_ADMIN_PLAN.md` §3
