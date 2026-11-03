# SYSTEM_ADMIN_REQ-002 前端系统设置页 + 审计日志页

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/system_admin.md` |
| 所属 plan | `docs/plan/SYSTEM_ADMIN_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/system-admin-frontend` |
| 状态 | `done` |

## 2. 需求描述

### 背景
后端 `system` 模块已交付（`GET/PUT /system/settings`、`GET /system/audit-logs`）。落地前端：系统设置页与审计日志页，导航接入，仅 `team_admin` 可见。

### 目标
- 新增 `features/system/`（types/api）：配置读写 + 审计日志查询封装。
- 系统设置页 `/settings`：配置表单（键值读写，覆盖 `notification.*` 等预留键）。
- 审计日志页 `/audit-logs`：日志列表 + 筛选（action/resourceType/userId/时间范围）+ 分页。
- 路由 + 导航接入（`team_admin` 可见）。

### 验收条件
- [x] `pnpm --filter portal-frontend dev` / `build` 通过。
- [x] 设置页可读写配置项。
- [x] 审计日志页可筛选并分页查看。
- [x] 导航「系统」入口仅 `team_admin` 可见。

## 3. 技术方案摘要
- 复用 React + TanStack Query + `request`（`@/lib/http`）既有模式（参考 `features/billing/`、`features/recommendation/`）。
- 路由在 `router.tsx` 与 `app-layout.tsx` 导航中接入，按 `useAuthStore` 角色控制可见性。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/SYSTEM_ADMIN_REQ-002_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
