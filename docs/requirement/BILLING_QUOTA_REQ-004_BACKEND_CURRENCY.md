# BILLING_QUOTA_REQ-004 后端货币汇率配置 + 换算服务

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/billing_quota.md`、`docs/feature/system_admin.md` |
| 所属 plan | `docs/plan/BILLING_QUOTA_CURRENCY_RATE_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/billing-currency-rate-backend` |
| 状态 | `done` |

## 2. 需求描述

### 背景
系统仅以「点数」计量（`cost = multiplier × totalTokens`），无货币/汇率概念，无法按金额展示额度与成本。本期落地后端「点数 ↔ 货币」汇率配置与换算服务，为前端展示与后续 `LIMIT.md` `spend` 维度提供统一口径。

### 目标
- 新增 `CurrencyConfig` 类型与校验：`{ displayCurrency: string, rates: { code, name, pointsPerUnit }[] }`。
- 新增 `CurrencyService`（`system` 模块）：
  - `getConfig(tenantId)`：读取 `SystemSetting` key `billing.currency`，未配置返回 `null`。
  - `toCurrency(points, code)` / `toPoints(amount, code)`：点↔货币双向换算，币种缺失或未配置返回 `null`。
- 新增 API：
  - `GET /system/currency`：返回 `CurrencyConfig | null`，`member`/`team_admin`/`system` 可读。
  - `PUT /system/currency`：`team_admin`/`system` 写入，DTO 校验（`code` 唯一、`pointsPerUnit > 0`、`displayCurrency` 须存在于 `rates`），写入 `billing.currency`，并审计埋点。
- 换算方向：`1 货币单位 = pointsPerUnit 点`（点→货币 = `points / pointsPerUnit`）。

### 验收条件
- [ ] `pnpm --filter portal-backend start:dev` 启动成功。
- [ ] Swagger 可调 `GET/PUT /system/currency`，未配置时 `GET` 返回 `null`。
- [ ] 配置 `{ displayCurrency: 'CNY', rates: [{code:'USD',name:'美元',pointsPerUnit:10000},{code:'CNY',name:'人民币',pointsPerUnit:1389}] }` 后，`toCurrency(10000,'USD') === 1`、`toPoints(1,'USD') === 10000`。
- [ ] 非法配置（`pointsPerUnit <= 0`、`displayCurrency` 不在 `rates`、重复 `code`）被拒绝。
- [ ] `PUT /system/currency` 触发审计埋点，`GET /system/audit-logs` 可查到对应记录。
- [ ] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过（含新增 `CurrencyService`/controller 单测）。

## 3. 技术方案摘要
- 复用 `SystemSetting`（`tenantId + key` 唯一、`value` JSON）存 `billing.currency`，不改动 schema。
- `CurrencyService` 注入 `SystemSettingModel`，落在 `system` 模块，导出供 billing 等模块复用。
- 复用 `JwtAuthGuard` + `RolesGuard` + `@Roles()` + `@CurrentUser()`；`GET` 开放 `member`，`PUT` 限 `team_admin`/`system`。
- 复用 `AuditService.log()` 埋点（action 如 `currency.update`）。
- 结构详见 `docs/plan/BILLING_QUOTA_CURRENCY_RATE_PLAN.md` §3 与 `docs/technical/db_schema/SYSTEM_ADMIN_SCHEMA.MD`。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/BILLING_QUOTA_REQ-004_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
