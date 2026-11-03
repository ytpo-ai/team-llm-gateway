# ADMIN_OVERVIEW_REQ-001 后端 admin 模块 + 超级管理员引导

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/admin_overview.md` |
| 所属 plan | `docs/plan/ADMIN_OVERVIEW_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/admin-overview-backend` |
| 状态 | `done` |

## 2. 需求描述

### 背景
9 大模块已有 8 个闭环，剩余服务商全局视角。落地后端：服务商（`system`）角色 + 启动期超级管理员引导 + `admin` 模块（租户管理 + 全局看板）。仅超级 Portal（SaaS）形态启用。

### 目标
- 服务商角色：复用 `Role.SYSTEM`；`User.tenantId` 改为可选（`default: null`），system 用户无团队归属。
- 引导机制：`SuperAdminBootstrapService` 读取 `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` 种入 `system` 用户（未设置则跳过）。
- 认证适配：`AuthService.login()` 先全局查找 system 用户；`resolveTeamId` 对 system 返回 `null`；`issueTokens` 接受 `teamId` 可空；system 用户 JWT `tenantId/teamId` 为空串。
- 新增 `admin` 模块：
  - 租户管理：`GET /admin/tenants`（分页 + 筛选 + 计数）、`GET /admin/tenants/:id`、`POST /admin/tenants`（建租户 + 默认团队）、`PATCH /admin/tenants/:id/status`（启停）。
  - 全局看板：`GET /admin/overview`（租户/团队/成员/Key 计数 + token/cost/request 聚合）、`GET /admin/overview/usage`（按租户用量拆分）。
- RBAC：`@Roles(Role.SYSTEM)`；admin 端点全局查询，不复用租户过滤。

### 验收条件
- [x] `pnpm --filter portal-backend start:dev` 启动成功。
- [x] 配置 `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` 后，`system` 账号可登录并调用 `/admin/*`。
- [x] 普通角色访问 `/admin/*` 被 403 拦截。
- [x] Swagger 可调 `GET/POST /admin/tenants`、`GET /admin/tenants/:id`、`PATCH /admin/tenants/:id/status`、`GET /admin/overview`、`GET /admin/overview/usage`。
- [x] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过（含新增 admin 单测）。

## 3. 技术方案摘要
- 复用 Nest.js + Mongoose 既有模式（参考 `modules/system/`、`modules/billing/`）。
- 复用 `JwtAuthGuard` + `RolesGuard` + `@Roles(Role.SYSTEM)` + `@CurrentUser()`。
- 无新增集合：复用 `Tenant`/`Team`/`User`/`ApiKey`/`UsageLog`；admin 服务通过 Mongoose 模型聚合计数与用量。
- Schema/DTO/API 契约详见 `docs/plan/ADMIN_OVERVIEW_PLAN.md` §3 与 `docs/technical/db_schema/ADMIN_OVERVIEW_SCHEMA.MD`。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/ADMIN_OVERVIEW_REQ-001_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
