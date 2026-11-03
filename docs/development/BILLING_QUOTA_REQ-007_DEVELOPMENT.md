# BILLING_QUOTA_REQ-007 开发记录（策略求值引擎）

> 对应需求：`docs/requirement/BILLING_QUOTA_REQ-007_POLICY_ENGINE.md`
> 对应计划：`docs/plan/BILLING_QUOTA_POLICY_PLAN.md`
> 分支：`main`

## 1. 实现摘要

重构转发层求值：`QuotaLimitService` 由「逐固定字段校验」改为「通用策略求值」，`ProxyService.enforceLimits` 统一走策略引擎，支持 token/request/concurrency/spend × 窗口 × block/warn，团队/角色/Key 三级取最严 AND，范围白名单逐级交集。

- `QuotaLimitService`：
  - `resolve()` 加载 Team/RoleTemplate/ApiKey 及其 `policySetId`，产出 `ResolvedPolicyContext`（team/role/key 三级 `PolicySet`）。
  - `isProviderAllowed` / `isModelAllowed` 逐级白名单交集。
  - `resolveRateLimits()` 提取「request×minute」与「concurrency」的 block 限值（供 proxy 层内存限流/并发计数）。
  - `assertUsageLimits()` 聚合 `UsageLog`（token/spend/request 长窗口）逐条目比对：`block` 超限抛 429，`warn` 仅 `Logger.warn` 记录事件不阻断。
- `UsageService` 新增 `sumCost` / `countRequests`（复用 `buildAggregateMatch`，口径与 `sumTokens` 一致）。
- `ProxyService`：删除对旧字段的引用，`enforceLimits` 改为「resolve → 范围校验 → 速率/并发 → 用量策略 → 余额预检」；并发计数由新增 `ConcurrencyService`（apikey 级内存计数，进 +1 / 结束 -1，单实例）。
- 时间窗口沿用固定自然窗口（`startOfHour/Day/Week/Month`，UTC）。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `proxy/concurrency.service.ts` | apikey 级并发内存计数器 |

### 修改

| 文件 | 说明 |
|---|---|
| `billing/quota-limit.service.ts` | 重写为策略求值引擎 |
| `usage/usage.service.ts` | 新增 `sumCost`/`countRequests` |
| `proxy/proxy.service.ts` | `enforceLimits`/`prepare`/`listModels` 走策略引擎 + 并发计数 |
| `proxy/proxy.module.ts` | 注册 `ConcurrencyService` |
| `billing/billing.module.ts` | 引入 `UsageModule` + `PolicySet` model |

## 3. 踩坑记录

1. **跨级不合并、同主体取 min**：团队/角色/key 三级各自有独立聚合主体（`teamId`/`userId`/`apiKeyId`），故跨级逐级独立校验（AND），不跨级取 min；同主体同 measure+window 的多条，因「越小的 limit 先触发」天然满足取最严，无需显式合并。
2. **minute/concurrency 与聚合分离**：`request×minute` 走内存滑动窗口（`RateLimitService`）、`concurrency` 走内存计数，与 `UsageLog` 聚合的 token/spend/request 长窗口分开，避免高频请求打 DB 聚合。

## 4. 验证结果

- `pnpm --filter portal-backend typecheck`：通过。
- `pnpm --filter portal-backend lint`：0 errors / 0 warnings。
- `pnpm --filter portal-backend test`：166 tests 通过（含求值引擎、并发、proxy 单测）。

## 5. 关联

- feature：`docs/feature/billing_quota.md`
- 上游：`docs/plan/BILLING_QUOTA_POLICY_PLAN.md` §3、§5；`docs/guide/LIMIT.md` §3~§5
