# ADMIN_OVERVIEW_REQ-002 开发记录（前端租户管理页 + 全局看板页）

> 对应需求：`docs/requirement/ADMIN_OVERVIEW_REQ-002_FRONTEND_ADMIN.md`
> 对应计划：`docs/plan/ADMIN_OVERVIEW_PLAN.md`
> 分支：`main`

## 1. 实现摘要

落地「服务商全局视角」前端：租户管理页 `/admin/tenants` + 全局看板页 `/admin/overview`，路由/导航接入，仅 `system` 角色可见。

- `features/admin/`：types + api 封装（租户列表/创建/启停 + 全局看板查询）。
- 租户管理页：新建租户表单 + 租户表格（名称/编码/状态/团队数/成员数/Key 数）+ 启停操作 + 搜索。
- 全局看板页：全局总量卡片（租户/团队/成员/Key/请求/Token/成本）+ 按租户用量拆分表格。
- 导航：`app-layout.tsx` 按 `user.role === 'system'` 渲染「全局概览」「租户」入口。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `features/admin/types.ts` | `Tenant`/`TenantPage`/`AdminOverview`/`TenantUsageItem`/`TenantUsageBreakdown` 类型 |
| `features/admin/api.ts` | `listTenants`/`createTenant`/`updateTenantStatus`/`getOverview`/`getUsageBreakdown` |
| `pages/admin-tenants.tsx` | 租户管理页 |
| `pages/admin-overview.tsx` | 全局看板页 |

### 修改

| 文件 | 说明 |
|---|---|
| `router.tsx` | 新增 `/admin/tenants`、`/admin/overview` 路由 |
| `components/layout/app-layout.tsx` | 新增 `system` 角色导航「全局概览」「租户」 |

## 3. 踩坑记录

1. **角色可见性**：前端 `User.role` 已含 `'system'` 字面量（`features/auth/types.ts`），直接 `user?.role === 'system'` 条件渲染即可，无需改类型。
2. **路由命名避免歧义**：团队级「概览」已是 `/`，全局看板命名 `/admin/overview`、租户管理 `/admin/tenants`，避免与团队 dashboard 冲突。

## 4. 验证结果

- `pnpm --filter portal-frontend typecheck`：通过。
- `pnpm --filter portal-frontend lint`：0 errors（1 个既有 warning，非本次改动）。
- `pnpm --filter portal-frontend build`：通过。

## 5. 关联

- feature：`docs/feature/admin_overview.md`
- 上游：`docs/plan/ADMIN_OVERVIEW_PLAN.md` §5
