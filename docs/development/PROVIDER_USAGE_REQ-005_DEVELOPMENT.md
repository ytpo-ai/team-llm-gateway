# 渠道健康熔断与被动信号强化 — 开发记录（PROVIDER_USAGE_REQ-005~007）

> 关联 Plan：`docs/plan/PROVIDER_USAGE_HEALTH_PLAN.md`
>
> 完成时间：2026-11-07
>
> 实现摘要：砍掉不可用的主动查询链路（fetchUsage / usageEndpoint / 字段猜测），ProviderUsage 改造为纯被动信号驱动的渠道健康模型（429 限流恢复窗口 + 错误率熔断冷却），补齐转发层网络错误兜底 fallback，前端「用量探测」列改造为「健康状态」列。

---

## 1. 改动文件清单

### 后端新增

| 文件 | 说明 |
|---|---|
| `apps/portal-backend/src/modules/usage/provider-usage.service.spec.ts` | 13 例：可用性判定 / 429 恢复窗口解析（Retry-After、x-ratelimit-reset、默认窗口、退避）/ 熔断阈值与退避 / 成功重置 / 响应头提取 |

### 后端修改

| 文件 | 说明 |
|---|---|
| `usage/provider-usage.service.ts` | 重写：删 `fetchAndCache()`/`genericFetchUsage()`/`pickNumber()`/`pickString()`/`upsert()`/`markError()`/`getSnapshot()`/`isExhausted()`；新增 `getAvailability()`/`recordFailure()`/`recordSuccess()`；`markExhausted()` 支持响应头解析与退避 |
| `usage/schemas/provider-usage.schema.ts` | 移除 `quotaTotal`/`quotaUsed`/`quotaUnit`/`isExhausted`/`QuotaUnit`；新增 `exhaustedUntil`/`consecutiveFailures`/`cooldownUntil` |
| `providers/schemas/provider.schema.ts` | 移除 `usageEndpoint` 字段 |
| `providers/dto/create-provider.dto.ts`、`update-provider.dto.ts` | 移除 `usageEndpoint` 参数 |
| `providers/providers.service.ts` | `ProviderView`/`create()`/`update()`/`toView()` 移除 `usageEndpoint` |
| `providers/providers.controller.ts` | 删除 `POST /providers/:id/fetch-usage` 端点及相关 import/注入 |
| `proxy/adapters/upstream-adapter.ts` | 移除 `ProviderUsageSnapshot` 类型与 `fetchUsage()` 可选方法（无任何实现） |
| `proxy/proxy.service.ts` | 四入口信号接线 + 网络错误兜底；`tryCandidate()` 改用 `getAvailability()`；新增 `headersToRecord()` |
| `config/configuration.ts` | 新增 `providerHealth.{failureThreshold,cooldownBaseMs,cooldownMaxMs,rateLimitCooldownMs}` |
| `.env.example` | 新增 `PROVIDER_FAILURE_THRESHOLD` 等 4 个环境变量 |
| `proxy/proxy.service.spec.ts` | mock 更新（`getAvailability`/`recordFailure`/`recordSuccess`）+ 新增 4 例（网络错误 fallback、429 带响应头、5xx+成功信号、冷却渠道跳过） |

### 前端

| 文件 | 说明 |
|---|---|
| `features/providers/types.ts` | Provider/Input/Patch 移除 `usageEndpoint`；`ProviderUsageView` 去 quota 字段、加 `exhaustedUntil`/`cooldownUntil`/`consecutiveFailures` |
| `features/providers/api.ts` | 移除 `fetchProviderUsage()` |
| `pages/providers.tsx` | 移除用量端点表单项、🔍 探测按钮、`fetchUsageMutation`、`fmtQuota`；「用量探测」列改造为「健康状态」列 |

---

## 2. 核心设计

### 2.1 信号驱动的状态机（纯被动，无上游用量 API 依赖）

```
失败信号（5xx / 408 / 网络错误）:
  recordFailure() → consecutiveFailures += 1
  failures >= failureThreshold(默认3):
    cooldownUntil = now + min(cooldownBaseMs × 2^(failures-threshold), cooldownMaxMs)

429 限流信号:
  markExhausted(headers) → consecutiveFailures += 1（复用退避计数）
  exhaustedUntil = Retry-After | x-ratelimit-reset-* | now + rateLimitCooldownMs × 2^(failures-1)

成功信号（2xx）:
  recordSuccess() → consecutiveFailures = 0, exhaustedUntil = null, cooldownUntil = null

可用性判定（tryCandidate → getAvailability）:
  unavailable = exhaustedUntil > now || cooldownUntil > now（无快照时乐观可用）
```

### 2.2 转发层四入口接线

```
for each candidate:
  ├─ tryCandidate() → active / policy / getAvailability
  ├─ fetch 抛异常（新增 try/catch）→ recordFailure(网络错误) → 下一候选
  ├─ 2xx → extractRateLimitHeaders() + recordSuccess() → 返回
  ├─ 429 → markExhausted(带响应头) → 下一候选
  ├─ 5xx/408 → recordFailure() → 下一候选
  └─ 其他 4xx → 记录错误日志，直接返回（不 fallback）
全部失败 → 502（lastError/lastBody）
```

网络错误兜底是本次补的缺口：原先 `requestUpstream` 的 fetch 抛异常（DNS/超时/连接拒绝）直接冒泡为 500，不触发任何 fallback 与健康记录。

### 2.3 配置项

| 配置 | 环境变量 | 默认 |
|---|---|---|
| `providerHealth.failureThreshold` | `PROVIDER_FAILURE_THRESHOLD` | 3 |
| `providerHealth.cooldownBaseMs` | `PROVIDER_COOLDOWN_BASE_MS` | 30000 |
| `providerHealth.cooldownMaxMs` | `PROVIDER_COOLDOWN_MAX_MS` | 600000 |
| `providerHealth.rateLimitCooldownMs` | `PROVIDER_RATE_LIMIT_COOLDOWN_MS` | 60000 |

---

## 3. 踩坑记录

- **vitest `clearAllMocks` 不清 mock 实现**：`proxy.service.spec.ts` 中「冷却渠道跳过」用例把 `getAvailability` mock 改为 unavailable 后，后续用例全部 fallback 到 502。修复：`beforeEach` 中显式重置默认实现。
- **mock 返回类型推断**：`vi.fn(() => ({ available: true, reason: null }))` 会把 `reason` 推断为 `null` 字面量类型，后续 `mockReturnValue({ reason: '...' })` 报 TS2322。修复：给 `vi.fn` 显式标注返回类型。
- **存量 ProviderUsage 文档**：旧字段（`quotaTotal` 等）残留在库中但不读写，MongoDB 无强约束，不做迁移。

---

## 4. 验证结果

- `pnpm run --filter portal-backend lint` ✅
- `pnpm run --filter portal-backend typecheck` ✅
- `pnpm run --filter portal-backend test` ✅（236 passed，26 files）
- `pnpm run --filter portal-frontend typecheck` / `lint` / `build` ✅

---

## 5. 后续扩展

- 少数提供余额 API 的平台（Moonshot `/users/me/balance`、DeepSeek `/user/balance`、OpenRouter `/credits`、new-api 系中转站）可按需在适配器层补内置实现，作为健康模型的补充信号
- 渠道健康事件（进入/解除冷却）接入审计日志或告警
- 半开（half-open）探测：冷却到期后放行单请求验证，而非直接全量恢复
