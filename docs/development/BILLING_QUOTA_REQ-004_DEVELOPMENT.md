# BILLING_QUOTA_REQ-004 开发记录（后端货币汇率配置 + 换算服务）

> 对应需求：`docs/requirement/BILLING_QUOTA_REQ-004_BACKEND_CURRENCY.md`
> 对应计划：`docs/plan/BILLING_QUOTA_CURRENCY_RATE_PLAN.md`
> 分支：`main`

## 1. 实现摘要

落地后端「点数 ↔ 货币」汇率配置与换算服务：复用 `SystemSetting`（key = `billing.currency`）存储多币种汇率，新增 `CurrencyService` 与 `GET/PUT /system/currency`，并补审计埋点。

- `CurrencyService`：`getConfig(tenantId)` 读取配置（未配置/结构非法返回 `null`）；`toCurrency(points, code, config)` / `toPoints(amount, code, config)` 双向换算（未配置或币种缺失返回 `null`）；`saveConfig` 结构化校验（code 唯一、`pointsPerUnit > 0`、`displayCurrency` 存在于 `rates`）。
- `CurrencyController`：`GET /system/currency`（`member` 及以上可读）+ `PUT /system/currency`（`team_admin`/`system` 写入，审计埋点 `currency_update`）。
- `AuditAction` 新增 `currency_update`、`AuditResourceType` 新增 `currency`。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `modules/system/currency.service.ts` | `CurrencyConfig`/`CurrencyRate` 类型 + 读配置/双向换算/兜底/校验 |
| `modules/system/currency.controller.ts` | `GET/PUT /system/currency` + 审计埋点 |
| `modules/system/dto/update-currency.dto.ts` | `CurrencyRateDto`/`UpdateCurrencyDto`（class-validator 校验） |
| `modules/system/currency.service.spec.ts` | 11 个单测（读配置/换算/校验/兜底） |
| `modules/system/currency.controller.spec.ts` | 2 个单测（读写 + 审计埋点） |

### 修改

| 文件 | 说明 |
|---|---|
| `modules/system/schemas/audit-log.schema.ts` | `AuditAction` 新增 `currency_update`；`AuditResourceType` 新增 `currency` |
| `modules/system/system.module.ts` | 注册 `CurrencyController`/`CurrencyService` 并导出 |

## 3. 踩坑记录

1. **`toCurrency`/`toPoints` 签名**：plan 中的 2 参签名无法感知租户，最终按「纯函数 + 传入已解析 config」落地（`toCurrency(points, code, config)`），`getConfig(tenantId)` 负责加载，未配置/币种缺失统一返回 `null`，与「口径统一」目标一致。
2. **跨字段校验**：`code` 唯一、`displayCurrency ∈ rates` 无法用 class-validator 表达，落在 `saveConfig` 内抛 `BadRequestException`，DTO 只负责 `pointsPerUnit > 0` 等基础校验。

## 4. 验证结果

- `pnpm --filter portal-backend typecheck`：通过。
- `pnpm --filter portal-backend lint`：0 warnings / 0 errors。
- `pnpm --filter portal-backend test`：155 passed（含新增 13 个）。
- `pnpm --filter portal-backend build`：通过。

## 5. 关联

- feature：`docs/feature/billing_quota.md`、`docs/feature/system_admin.md`
- 上游：`docs/plan/BILLING_QUOTA_CURRENCY_RATE_PLAN.md` §3
- 数据模型：`docs/technical/db_schema/SYSTEM_ADMIN_SCHEMA.MD`（补 `billing.currency` + `currency_update` 埋点）
