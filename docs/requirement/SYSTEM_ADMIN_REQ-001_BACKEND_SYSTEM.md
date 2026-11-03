# SYSTEM_ADMIN_REQ-001 后端系统配置 + 审计日志

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/system_admin.md` |
| 所属 plan | `docs/plan/SYSTEM_ADMIN_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/system-admin-backend` |
| 状态 | `done` |

## 2. 需求描述

### 背景
9 大模块已有 7 个闭环，尚缺系统管理基础能力。落地后端：租户级系统配置（`SystemSetting`）与审计日志（`AuditLog`），并在关键写操作注入审计埋点（billing/api-keys/models/providers/teams），满足运营合规。服务商/系统角色在开源单团队版隐藏，仅 `team_admin` 可见。

### 目标
- 新增 `SystemSetting` schema：`tenantId + key` 唯一，`value` JSON，`updatedBy`，upsert 语义。
- 新增 `AuditLog` schema：`tenantId/teamId/userId` + `action/resourceType/resourceId/summary` + `before/after` JSON 快照 + `ip/userAgent`，只增不改。
- 新增 `system` 模块：
  - `SystemSettingService`：`GET /system/settings`（列表）、`PUT /system/settings`（批量 upsert）。
  - `AuditService`：`log()` 埋点 + `GET /system/audit-logs`（分页 + 筛选）。
- 审计埋点注入：billing（recharge/adjust）、api-keys（create/revoke/rotate）、models（create/disable）、providers（create/disable）、teams（角色变更/移除/邀请）。
- RBAC：`team_admin`；所有读写按 `tenantId` 隔离。

### 验收条件
- [x] `pnpm --filter portal-backend start:dev` 启动成功。
- [x] Swagger 可调 `GET/PUT /system/settings` 与 `GET /system/audit-logs`。
- [x] 执行关键写操作后，审计日志能查询到对应记录（action/resourceType/resourceId/summary）。
- [x] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过（含新增 system 单测）。

## 3. 技术方案摘要
- 复用 Nest.js + Mongoose 既有模式（参考 `apps/portal-backend/src/modules/billing/`、`usage/`）。
- 复用 `JwtAuthGuard` + `RolesGuard` + `@Roles(Role.TEAM_ADMIN)` + `@CurrentUser()`。
- `SystemModule` 导出 `AuditService`，供 billing/api-keys/models/providers/teams 模块注入。
- Schema/DTO 详见 `docs/plan/SYSTEM_ADMIN_PLAN.md` §3 与 `docs/technical/db_schema/SYSTEM_ADMIN_SCHEMA.MD`。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/SYSTEM_ADMIN_REQ-001_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
