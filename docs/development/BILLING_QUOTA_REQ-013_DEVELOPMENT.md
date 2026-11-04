# BILLING_QUOTA_REQ-013 开发记录（金额列追加 Token 数）

> 对应需求：`docs/requirement/BILLING_QUOTA_REQ-013_TOKEN_DISPLAY.md`
> 对应计划：`docs/plan/BILLING_QUOTA_TX_TOKEN_PLAN.md`
> 分支：`feat/billing-menu-split`

## 1. 实现摘要

流水列表金额列在点数后追加展示本次用量 Token 数。因流水表此前未存储 Token 数，需补齐「落库 → 透出 → 展示」链路。

### 后端
- `schemas/quota-transaction.schema.ts`：新增 `totalTokens: number | null`（默认 `null`）。
- `billing.service.ts`：`QuotaTransactionView` 新增 `totalTokens`；`DeductInput` 新增 `totalTokens?`；`deduct()` 落库 `totalTokens` 并返回；`listTransactions` 映射透出 `row.totalTokens ?? null`。
- `proxy/proxy.service.ts`：`recordUsage` 在 `deduct()` 时传入已计算的 `totalTokens`。
- `billing.service.spec.ts`：`makeTx` 默认补 `totalTokens: null`；新增 `totalTokens` 映射用例；`deduct` 用例断言 `totalTokens` 落库与返回。

### 前端
- `features/billing/types.ts`：`QuotaTransaction` 新增 `totalTokens: number | null`。
- `pages/billing.tsx`：金额列点数后追加 `<span>{totalTokens} Token</span>`，仅当 `item.totalTokens > 0` 展示。

## 2. 代码改动点

| 文件 | 说明 |
|---|---|
| `apps/portal-backend/src/modules/billing/schemas/quota-transaction.schema.ts` | 新增 `totalTokens` 字段 |
| `apps/portal-backend/src/modules/billing/billing.service.ts` | 视图/入参/落库/透出 `totalTokens` |
| `apps/portal-backend/src/modules/proxy/proxy.service.ts` | `deduct()` 传入 `totalTokens` |
| `apps/portal-backend/src/modules/billing/billing.service.spec.ts` | 更新/新增测试 |
| `apps/portal-frontend/src/features/billing/types.ts` | `QuotaTransaction.totalTokens` |
| `apps/portal-frontend/src/pages/billing.tsx` | 金额列展示 Token 数 |
| `docs/technical/db_schema/BILLING_QUOTA_SCHEMA.MD` | 补充 `totalTokens` 字段说明 |

## 3. 踩坑记录

1. **Token 数原本未落库**：`deduct` 只存 `amount = multiplier × totalTokens` 与 `referenceId`（requestId），未保留 `totalTokens`；如需展示必须新增字段，无法仅由 `amount` 反推（`multiplier` 也未落库）。
2. **仅用量流水有值**：`totalTokens` 只在 `deduct`（`source: usage`）写入；充值/调整走 `recharge`/`adjust`，不写入，故展示需判空（`null` 或 `> 0`），避免显示无意义的 `null Token`。
3. **历史数据不回填**：存量流水 `totalTokens` 为 `null`，按「不展示」处理。

## 4. 验证结果

- 后端 `pnpm --filter portal-backend typecheck`：通过。
- 后端 `pnpm --filter portal-backend test`：通过（202 passed）。
- 后端 `pnpm --filter portal-backend lint`：通过。
- 前端 `pnpm --filter portal-frontend typecheck` / `lint` / `build`：通过（仅 2 条既有 warning）。

## 5. 关联

- feature：`docs/feature/billing_quota.md`
- 上游：`docs/plan/BILLING_QUOTA_TX_TOKEN_PLAN.md` §3
