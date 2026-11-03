# 系统管理模块开发计划（SYSTEM_ADMIN）

> 本 plan 固化 Portal 基础能力 **系统管理（system_admin）** 的工程方案，落地 `SYSTEM_POSITIONING_AND_ARCHITECTURE.MD` §5.3 中系统配置管理、审计日志（运营合规）、通知（可选）三项职责。
>
> - 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（§5.2/§5.3）
> - 上游 plan：`docs/plan/PORTAL_FOUNDATION_PLAN.md`（9 大模块清单）
> - 定稿时间：2026-10-29
> - 状态：已完成

---

## 1. 需求背景

9 大模块中已有 7 个模块闭环（tenant_auth → team_member → api_key → model_provider → usage_metering → billing_quota → model_recommendation），尚缺基础能力 **系统管理**：租户级系统配置、关键操作审计日志（运营合规）。服务商/系统角色在开源单团队版中隐藏（仅 `team_admin` 可见），通知为可选能力本期不实现（仅预留）。

## 2. 目标

1. 新增 `SystemSetting`（租户级 KV 配置）与 `AuditLog`（只增不改的审计流水）两个数据模型。
2. 新增 `system` 模块：`SystemSettingService`（配置读写）+ `AuditService`（审计埋点 + 查询）。
3. 在关键写操作注入审计埋点：billing（recharge/adjust）、api-keys（create/revoke/rotate）、models & providers（create/disable）、teams（角色变更/移除/邀请）。
4. REST API：`GET/PUT /system/settings`（`team_admin`）、`GET /system/audit-logs`（`team_admin`，分页/筛选）。
5. 前端：系统设置页 `/settings` + 审计日志页 `/audit-logs`，导航接入（`team_admin` 可见）。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 配置模型 | `SystemSetting`：`tenantId + key` 唯一，`value` 存 JSON，`updatedBy` 记录最后修改人，upsert 语义 |
| 审计模型 | `AuditLog`：`tenantId/teamId/userId` + `action/resourceType/resourceId/summary` + `before/after` JSON 快照 + `ip/userAgent`，只增不改 |
| 配置 API | `GET /system/settings`（列表）+ `PUT /system/settings`（批量 upsert key-value）；仅 `team_admin` |
| 审计 API | `GET /system/audit-logs`：分页 + `action/resourceType/userId/from/to` 筛选，按 `createdAt` 倒序；仅 `team_admin` |
| 埋点方式 | `AuditService.log()` 进程内同步写入，注入 billing/api-keys/models/providers/teams 既有服务，`module` 导入 `SystemModule` 暴露 `AuditService` |
| 租户隔离 | 所有读写按 `tenantId`（+`teamId`）过滤，复用 `@CurrentUser()` |
| 鉴权 | 复用 `JwtAuthGuard` + `RolesGuard` + `@Roles(Role.TEAM_ADMIN)`；`system` 角色在开源版隐藏 |
| 通知 | 本期不实现，`SystemSetting` 预留 `notification.*` 配置键 |

## 4. RBAC 设计

| 资源 | 读 | 写 |
|---|---|---|
| `system/settings` | `team_admin` | `team_admin` |
| `system/audit-logs` | `team_admin` | 无（系统埋点写入） |

## 5. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [SYSTEM_ADMIN_REQ-001](../requirement/SYSTEM_ADMIN_REQ-001_BACKEND_SYSTEM.md) | 后端：`SystemSetting`/`AuditLog` schema + `system` 模块（配置读写 + 审计埋点/查询）+ 审计埋点注入既有模块 + 单测 | `start:dev` 启动，Swagger 可调 `/system/settings` 与 `/system/audit-logs`，审计埋点生效，lint/typecheck/test 通过 |
| [SYSTEM_ADMIN_REQ-002](../requirement/SYSTEM_ADMIN_REQ-002_FRONTEND_SYSTEM.md) | 前端：系统设置页 `/settings` + 审计日志页 `/audit-logs` + 路由/导航接入（`team_admin` 可见） | `dev`/`build` 通过，设置页可读写配置，审计日志页可筛选查看 |

## 6. 里程碑

1. ✅ REQ-001 后端配置 + 审计（本文档拆解）。
2. ✅ REQ-002 前端设置页 + 审计日志页闭环。
3. ✅ 9 大模块基础能力补齐（剩余 `admin_overview` 仅 SaaS 形态）。

## 7. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| R-01 | 审计埋点需改动 billing/api-keys/models/providers/teams 5 个既有服务 | 需跑通全部单测/lint/typecheck 防回归 |
| R-02 | 通知能力本期不实现 | 仅预留 `notification.*` 配置键，避免范围膨胀 |
| R-03 | 审计日志增长与保留策略 | 首期只增不改，保留策略后续（可配置 `audit.retentionDays`） |

## 8. 关联

- 上游：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（§5.2/§5.3）
- feature：`docs/feature/system_admin.md`
- requirement：见 §5
