# REQ-006：渠道健康模型与熔断冷却（含转发层接线）

> 关联 Feature：`docs/feature/model_provider.md`、`docs/feature/usage_metering.md`
> 关联 Plan：`docs/plan/PROVIDER_USAGE_HEALTH_PLAN.md`
> 状态：✅ 已完成
> 开发记录：`docs/development/PROVIDER_USAGE_REQ-005_DEVELOPMENT.md`

## 背景

被动信号是跨平台普适的渠道健康来源，但现有实现有三个缺口：`isExhausted` 靠 TTL 隐式恢复语义含糊；5xx/408 仅当次跳过无累计熔断；网络异常（fetch 抛错）直接 500 不 fallback。

## 验收条件

- [x] ProviderUsage schema 新增 `exhaustedUntil` / `consecutiveFailures` / `cooldownUntil`，移除旧 `isExhausted` 字段语义
- [x] `markExhausted()` 解析 `Retry-After` / `x-ratelimit-reset-*` 响应头推算恢复时间，缺省回落可配默认窗口（60s），重复 429 叠加退避
- [x] 新增 `recordFailure()`：连续失败达阈值（默认 3）进入冷却，指数退避 30s 基数、10min 封顶
- [x] 新增 `recordSuccess()`：重置失败计数、清除 exhausted/cooldown 状态
- [x] 统一可用性判定（`getAvailability()`）替代旧 `isExhausted()`，`tryCandidate()` 跳过冷却中渠道
- [x] 四入口接线：429 → markExhausted；5xx/408 → recordFailure；网络异常 try/catch → recordFailure + fallback；成功 → recordSuccess
- [x] 配置项 `providerHealth.failureThreshold` / `cooldownBaseMs` / `cooldownMaxMs` / `rateLimitCooldownMs` 入 `configuration.ts` + `.env.example`
- [x] 单测覆盖：熔断退避、429 恢复窗口解析、成功重置、可用性判定、网络错误 fallback
- [x] lint / typecheck / test 通过

## 代码位置

- `apps/portal-backend/src/modules/usage/provider-usage.service.ts`、`usage/schemas/provider-usage.schema.ts`
- `apps/portal-backend/src/modules/proxy/proxy.service.ts`
- `apps/portal-backend/src/config/configuration.ts`、`.env.example`
