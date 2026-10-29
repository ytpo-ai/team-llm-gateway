# 服务商全局视角（admin_overview）

## 1. 功能设计

### 目标
- 多租户管理（租户列表/详情/创建/启停）。
- 全局看板：看多个团队的基础情况与模型使用情况（§5.3）。
- 客户团队角色的托管接入（创建租户时自动初始化默认团队）。
- 仅 SaaS（超级 Portal）形态启用；开源单团队版隐藏。

### 数据结构
- 复用 `Tenant`（`code`/`name`/`status`/`config`，见 `docs/technical/db_schema/ADMIN_OVERVIEW_SCHEMA.MD`），不新增集合。
- 服务商角色复用 `Role.SYSTEM`（`system`），`User.tenantId/teamId` 可为空（跨租户）。

### 核心逻辑
- 服务商（超级管理员）引导：`SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` 环境变量，启动期 upsert 一个 `system` 用户。
- `admin` 模块：
  - 租户管理：`GET/POST /admin/tenants`、`GET /admin/tenants/:id`、`PATCH /admin/tenants/:id/status`。
  - 全局看板：`GET /admin/overview`（租户/团队/成员/Key 计数 + token/cost/request 聚合）、`GET /admin/overview/usage`（按租户用量拆分）。
- 鉴权：`@Roles(Role.SYSTEM)`，admin 端点全局查询，不复用租户过滤。

## 2. 需求追溯

| Plan | Requirement | Development | Fix |
|------|------------|-------------|-----|
| [ADMIN_OVERVIEW](../plan/ADMIN_OVERVIEW_PLAN.md) | [REQ-001](../requirement/ADMIN_OVERVIEW_REQ-001_BACKEND_ADMIN.md)、[REQ-002](../requirement/ADMIN_OVERVIEW_REQ-002_FRONTEND_ADMIN.md) | [REQ-001](../development/ADMIN_OVERVIEW_REQ-001_DEVELOPMENT.md)、[REQ-002](../development/ADMIN_OVERVIEW_REQ-002_DEVELOPMENT.md) | — |

## 3. 相关文档
- 技术文档：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-03、§2.2、§5.3）
- 数据模型：`docs/technical/db_schema/ADMIN_OVERVIEW_SCHEMA.MD`

## 4. 相关代码文件
- 后端：`apps/portal-backend/src/modules/admin/`、`apps/portal-backend/src/modules/auth/auth.service.ts`、`apps/portal-backend/src/modules/users/`
- 前端：`apps/portal-frontend/src/features/admin/`、`apps/portal-frontend/src/pages/admin-tenants.tsx`、`apps/portal-frontend/src/pages/admin-overview.tsx`
