# 系统管理（system_admin）

## 1. 功能设计

### 目标
- 系统配置管理。
- 审计日志（运营合规）。
- 通知（可选）。
- 服务商/系统角色在开源单团队版中隐藏。

### 数据结构
- `SystemSetting`（租户级 KV 配置）：`tenantId + key` 唯一，`value` JSON，`updatedBy`。见 `docs/technical/db_schema/SYSTEM_ADMIN_SCHEMA.MD`。
- `AuditLog`（审计流水）：`tenantId/teamId/userId` + `action/resourceType/resourceId/summary` + `before/after` 快照 + `ip/userAgent`，只增不改。见 `docs/technical/db_schema/SYSTEM_ADMIN_SCHEMA.MD`。

### 核心逻辑
- `SystemSettingsService`：`GET/PUT /system/settings`（批量 upsert，`team_admin`）。
- `CurrencyService`：`GET/PUT /system/currency`（点数↔货币汇率配置，`member` 可读、`team_admin` 可写），未配置回退纯点数展示。
- `AuditService`：`log()` 进程内埋点 + `GET /system/audit-logs`（分页 + 筛选，`team_admin`）。
- 审计埋点：billing（recharge/adjust）、api-keys（create/revoke/rotate）、models（create/disable）、providers（create/disable）、teams（角色变更/移除/邀请）、system（currency_update）。
- 通知：本期不实现，`SystemSetting` 预留 `notification.*` 配置键。

## 2. 需求追溯

| Plan | Requirement | Development | Fix |
|------|------------|-------------|-----|
| [SYSTEM_ADMIN](../plan/SYSTEM_ADMIN_PLAN.md) | [REQ-001](../requirement/SYSTEM_ADMIN_REQ-001_BACKEND_SYSTEM.md)、[REQ-002](../requirement/SYSTEM_ADMIN_REQ-002_FRONTEND_SYSTEM.md) | — | — |
| [TEAM_MANAGEMENT_OPTIMIZATION](../plan/TEAM_MANAGEMENT_OPTIMIZATION_PLAN.md) | [REQ-003 系统管理员+菜单](../requirement/TEAM_MANAGEMENT_REQ-003_SYSTEM_ADMIN_MENU.md) | [开发记录](../development/TEAM_MANAGEMENT_REQ-003_DEVELOPMENT.md) | — |
| [BILLING_QUOTA_CURRENCY_RATE](../plan/BILLING_QUOTA_CURRENCY_RATE_PLAN.md) | [REQ-004 后端货币汇率](../requirement/BILLING_QUOTA_REQ-004_BACKEND_CURRENCY.md) | [开发记录](../development/BILLING_QUOTA_REQ-004_DEVELOPMENT.md) | — |
| 同上 | [REQ-005 前端货币设置与展示](../requirement/BILLING_QUOTA_REQ-005_FRONTEND_CURRENCY.md) | [开发记录](../development/BILLING_QUOTA_REQ-005_DEVELOPMENT.md) | — |
| [SYSTEM_ADMIN_ACCOUNT_MENU](../plan/SYSTEM_ADMIN_ACCOUNT_MENU_PLAN.md) | [REQ-003 账号与菜单优化](../requirement/SYSTEM_ADMIN_REQ-003_ACCOUNT_MENU.md) | [开发记录](../development/SYSTEM_ADMIN_REQ-003_DEVELOPMENT.md) | — |

## 3. 相关文档
- 技术文档：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（§5.2/§5.3）
- 数据模型：`docs/technical/db_schema/SYSTEM_ADMIN_SCHEMA.MD`

## 4. 相关代码文件
- 后端：`apps/portal-backend/src/modules/system/`
- 前端：`apps/portal-frontend/src/features/system/`、`apps/portal-frontend/src/pages/settings.tsx`、`apps/portal-frontend/src/pages/audit-logs.tsx`
