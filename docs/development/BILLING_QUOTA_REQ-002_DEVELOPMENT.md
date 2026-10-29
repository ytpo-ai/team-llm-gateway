# BILLING_QUOTA_REQ-002 开发记录（转发层限额联动）

> 对应需求：`docs/requirement/BILLING_QUOTA_REQ-002_BACKEND_PROXY_ENFORCEMENT.md`
> 对应计划：`docs/plan/BILLING_QUOTA_PLAN.md`
> 分支：`main`

## 1. 实现摘要

落地转发层限额联动，闭环 USAGE_METERING U-01：转发前校验速率/预算/余额，转发后按实际成本扣减额度。

- `RateLimitService`：内存滑动窗口计数（`Map<keyId, number[]>`），`rateLimitPerMinute` 超限返回 429。
- `maxTokens` 预算：转发前 `UsageService.sumTokensByApiKey()` 聚合 `UsageLog` 该 key 累计 token，超限返回 429。
- 余额预检：转发前 `BillingService.getSpendableBalance()`，余额 ≤ 0 返回 402。
- 转发后扣减：`recordUsage()` 内按 `cost = multiplier × totalTokens` 调用 `deduct()`，仅 `totalTokens > 0` 时扣。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `modules/proxy/rate-limit.service.ts` | 内存滑动窗口速率限制 |
| `modules/proxy/rate-limit.service.spec.ts` | 单测（3 例） |

### 修改

| 文件 | 说明 |
|---|---|
| `modules/proxy/proxy.service.ts` | 注入 Billing/RateLimit，`enforceLimits()` 预检 + `recordUsage()` 扣减 |
| `modules/proxy/proxy.module.ts` | 引入 `BillingModule`、注册 `RateLimitService` |
| `modules/usage/usage.service.ts` | 新增 `sumTokensByApiKey()` 累计 token 聚合 |
| `modules/proxy/proxy.service.spec.ts` | 补充 limit 场景单测 + 新增依赖 mock |

## 3. 踩坑记录

1. **预检顺序**：`enforceLimits()` 放在 `prepare()` 开头（模型解析之前），速率/预算/余额失败时快速拒绝，不进入上游转发，避免无谓扣费。
2. **单测 mock 泄漏**：`assertAllowed.mockImplementation(() => { throw })` 在 `vi.clearAllMocks()` 下不会清除实现，导致后续用例被误拦；在 `beforeEach` 显式 `mockReset()` 兜底。
3. **扣减时机**：流式响应在 `finally` 中 `res.end()` 后扣减，非流式在返回前扣减；`totalTokens === 0`（上游未返回 usage）跳过扣减，避免零金额流水。

## 4. 验证结果

- `pnpm --filter portal-backend lint`：0 errors / 0 warnings。
- `pnpm --filter portal-backend typecheck`：通过。
- `pnpm --filter portal-backend test`：61 passed（proxy 8 + rate-limit 3）。

## 5. 关联

- feature：`docs/feature/billing_quota.md`
- 上游：`docs/plan/BILLING_QUOTA_PLAN.md` §3、`docs/plan/USAGE_METERING_PLAN.md` U-01
