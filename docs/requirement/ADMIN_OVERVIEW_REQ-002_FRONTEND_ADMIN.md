# ADMIN_OVERVIEW_REQ-002 前端租户管理页 + 全局看板页

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/admin_overview.md` |
| 所属 plan | `docs/plan/ADMIN_OVERVIEW_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/admin-overview-frontend` |
| 状态 | `done` |

## 2. 需求描述

### 背景
后端 `admin` 模块已交付（`/admin/tenants`、`/admin/overview`、`/admin/overview/usage`）。落地前端：租户管理页 + 全局看板页，路由/导航接入，仅 `system` 角色可见。

### 目标
- 新增 `features/admin/`（types/api）：租户列表/详情/创建/启停 + 全局看板查询封装。
- 租户管理页 `/admin/tenants`：租户表格（名称/编码/状态/团队数/成员数/Key 数）+ 启停操作 + 新建租户表单。
- 全局看板页 `/admin/overview`：全局总量卡片 + 按租户用量拆分表格（token/cost/请求数）。
- 路由 + 导航接入（仅 `system` 角色可见）。

### 验收条件
- [x] `pnpm --filter portal-frontend dev` / `build` 通过。
- [x] `system` 账号可见「全局」导航入口并可访问 `/admin/tenants`、`/admin/overview`。
- [x] 普通角色不可见导航入口，且访问 admin 路由被拦截（或后端 403）。
- [x] 租户管理页可新建/启停租户，看板页展示全局与按租户用量。

## 3. 技术方案摘要
- 复用 React + TanStack Query + `request`（`@/lib/http`）既有模式（参考 `features/system/`、`features/billing/`）。
- 路由在 `router.tsx` 与 `app-layout.tsx` 导航中接入，按 `useAuthStore` 角色（`system`）控制可见性。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/ADMIN_OVERVIEW_REQ-002_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
