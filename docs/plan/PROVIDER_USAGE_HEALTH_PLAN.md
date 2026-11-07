# 渠道健康熔断与被动信号强化（PROVIDER_USAGE_HEALTH）

> 本 plan 调整渠道用量感知的实现路线：**砍掉主动查询**（`fetchUsage` / `usageEndpoint` / 通用字段猜测），**强化被动信号**（429 限流恢复窗口、错误率熔断冷却、响应头速率追踪），并补齐网络错误兜底 fallback。
>
> - 上游 plan：`PROVIDER_USAGE_SENSE_PLAN.md`（本 plan 修正其「主动查询」方向，保留其 fallback 骨架）
> - feature：`docs/feature/model_provider.md`、`docs/feature/usage_metering.md`
> - 定稿时间：2026-11-06
> - 状态：`done`

---

## 1. 需求背景

`PROVIDER_USAGE_SENSE_PLAN` 交付后，实际使用发现：

1. **主动查询是空腿**：`UpstreamAdapter.fetchUsage()` 接口定义了但无任何适配器实现；通用 `usageEndpoint` + 字段猜测（`pickNumber(['total','limit',...])`）命中率极低。大多数 LLM 平台不提供用量查询 API，该路线事实不可用（鸡肋）。
2. **被动信号才是可靠来源**：429 熔断标记、响应头 `x-ratelimit-*` 提取不依赖上游提供专门 API，对所有平台普适。
3. **现有被动信号有缺口**：
   - `isExhausted` 依赖快照 TTL（30s）隐式恢复，语义含糊；
   - 5xx/408 仅当次跳过，无累计熔断——持续故障的渠道每次请求都被重试，放大延迟；
   - `requestUpstream` 未捕获网络异常（DNS/超时/连接拒绝），直接抛 500，不触发 fallback。

## 2. 目标

### 阶段 1：移除主动查询链路
1. 删除 `ProviderUsageService.fetchAndCache()` / `genericFetchUsage()` 及辅助方法、`POST /providers/:id/fetch-usage` 端点
2. Provider schema / DTO / service 移除 `usageEndpoint` 字段；`UpstreamAdapter` 移除 `fetchUsage()` 与 `ProviderUsageSnapshot` 类型
3. ProviderUsage schema 移除 `quotaTotal` / `quotaUsed` / `quotaUnit`（无写入源）
4. 前端移除用量查询端点表单项、🔍 探测按钮及相关 API

### 阶段 2：渠道健康模型 + 熔断冷却
5. ProviderUsage 扩展：`exhaustedUntil`（429 恢复时间）、`consecutiveFailures`、`cooldownUntil`（故障冷却截止时间）
6. `markExhausted()` 支持解析 `Retry-After` / `x-ratelimit-reset-*` 响应头推算恢复时间，缺省回落可配默认窗口（60s）；重复 429 叠加退避
7. 新增 `recordFailure()`（连续失败达阈值进入冷却，指数退避 30s→10min）与 `recordSuccess()`（重置计数、清除不可用状态）
8. 统一可用性判定替代原 `isExhausted()`（含冷却判定），配置项入 `configuration.ts` + `.env.example`

### 阶段 3：转发层接线 + 前端健康状态
9. 四入口统一：429 → `markExhausted()`；5xx/408 → `recordFailure()`；网络异常（try/catch 新增兜底）→ `recordFailure()` + fallback；成功 → `recordSuccess()`
10. `tryCandidate()` 可用性检查改为新判定（冷却中渠道跳过并记日志）
11. 前端「用量探测」列改造为「健康状态」列：正常（含速率余量）/ 限流中（恢复时间）/ 冷却中（恢复时间 + 失败次数）

## 3. 技术方案要点

### 3.1 ProviderUsage Schema 变更

| 变更 | 字段 | 说明 |
|---|---|---|
| 移除 | `quotaTotal` / `quotaUsed` / `quotaUnit` | 主动查询删除后无写入源；MongoDB 无强约束，旧数据残留不读写即可，不做迁移 |
| 新增 | `exhaustedUntil: Date \| null` | 429 限流恢复时间；`> now` 即不可用 |
| 新增 | `consecutiveFailures: number` | 连续失败计数（5xx/408/网络错误/重复 429） |
| 新增 | `cooldownUntil: Date \| null` | 故障冷却截止时间；`> now` 即不可用 |
| 调整 | `isExhausted` 字段移除 | 语义由 `exhaustedUntil` 取代 |
| 调整 | `lastStatus` 枚举 | 保留 `ok` / `exhausted` / `error`，`exhausted` 含限流与冷却两态（由字段区分） |

### 3.2 熔断与恢复策略

```
失败信号（5xx / 408 / 网络错误 / 429）:
  consecutiveFailures += 1
  429: exhaustedUntil = max(now, Retry-After | x-ratelimit-reset | now + rateLimitCooldownMs × 2^(429连续次数-1))
  consecutiveFailures >= failureThreshold(默认3):
    cooldownUntil = now + min(cooldownBaseMs × 2^(failures-threshold), cooldownMaxMs)

成功信号（2xx）:
  consecutiveFailures = 0
  exhaustedUntil = null, cooldownUntil = null, lastStatus = ok

可用性判定（tryCandidate）:
  unavailable = exhaustedUntil > now || cooldownUntil > now
```

### 3.3 配置项（`providerHealth.*`）

| 配置 | 环境变量 | 默认 | 说明 |
|---|---|---|---|
| `failureThreshold` | `PROVIDER_FAILURE_THRESHOLD` | 3 | 连续失败进入冷却的阈值 |
| `cooldownBaseMs` | `PROVIDER_COOLDOWN_BASE_MS` | 30000 | 冷却退避基数 |
| `cooldownMaxMs` | `PROVIDER_COOLDOWN_MAX_MS` | 600000 | 冷却退避封顶 |
| `rateLimitCooldownMs` | `PROVIDER_RATE_LIMIT_COOLDOWN_MS` | 60000 | 429 默认恢复窗口（响应头缺失时） |

### 3.4 转发层网络错误兜底

`requestUpstream` 外层 try/catch：fetch 抛异常时 `recordFailure()` 并 `continue` 下一候选，全部候选失败返回 502（原行为为直接抛 500，无 fallback）。

## 4. 影响范围

### 后端

| 文件 | 改动 |
|---|---|
| `usage/provider-usage.service.ts` | 删主动查询；新增 recordFailure/recordSuccess/可用性判定；markExhausted 响应头解析 |
| `usage/schemas/provider-usage.schema.ts` | 字段变更（见 §3.1） |
| `providers/providers.controller.ts` | 删 `POST /:id/fetch-usage` |
| `providers/schemas/provider.schema.ts`、`dto/*.ts`、`providers.service.ts` | 移除 `usageEndpoint` |
| `proxy/adapters/upstream-adapter.ts` | 移除 `fetchUsage()` / `ProviderUsageSnapshot` |
| `proxy/proxy.service.ts` | 四路信号接线 + 网络错误兜底 + tryCandidate 可用性判定 |
| `config/configuration.ts`、`.env.example` | 新增 `providerHealth` 配置 |
| `usage/provider-usage.service.spec.ts`（新增）、`proxy/proxy.service.spec.ts` | 测试更新 |

### 前端

| 文件 | 改动 |
|---|---|
| `pages/providers.tsx` | 移除 usageEndpoint 表单/🔍 按钮；「用量探测」列改「健康状态」列 |
| `features/providers/types.ts`、`api.ts` | 移除 usageEndpoint / fetchProviderUsage；ProviderUsageView 调整 |

### API 变更

- 删除：`POST /providers/:id/fetch-usage`
- 调整：`GET /usage/providers` 视图字段（去 quota*，加 exhaustedUntil/cooldownUntil/consecutiveFailures），语义改为渠道健康状态

## 5. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [REQ-005](../requirement/PROVIDER_USAGE_REQ-005_REMOVE_ACTIVE_QUERY.md) | 移除主动查询链路（后端 + 前端） | 主动查询代码/端点/字段/表单全部移除，lint/typecheck/test 通过 |
| [REQ-006](../requirement/PROVIDER_USAGE_REQ-006_HEALTH_CIRCUIT_BREAKER.md) | 渠道健康模型 + 熔断冷却 + 转发层接线 | 429/5xx/网络错误/成功四路信号生效，冷却中渠道被跳过，单测覆盖 |
| [REQ-007](../requirement/PROVIDER_USAGE_REQ-007_FRONTEND_HEALTH_COLUMN.md) | 前端健康状态列改造 | 渠道页展示正常/限流中/冷却中状态，typecheck/build 通过 |

## 6. 里程碑

1. ✅ REQ-005 移除主动查询链路
2. ✅ REQ-006 渠道健康模型与熔断冷却
3. ✅ REQ-007 前端健康状态列

## 7. 风险

| 编号 | 事项 | 状态 |
|---|---|---|
| R-01 | 429 恢复窗口依赖响应头，缺失时默认 60s 可能短于实际限流窗口 | 缓解：重复 429 叠加退避（复用连续计数） |
| R-02 | 全部渠道冷却时请求直接 502 | 预期行为（fail fast），日志带不可用原因 |
| R-03 | 存量 ProviderUsage 文档残留旧字段 | MongoDB 无强约束，旧字段不读写即可，不做迁移 |

## 8. 关联

- 上游：`PROVIDER_USAGE_SENSE_PLAN.md`（本 plan 修正其主动查询方向）
- feature：`docs/feature/model_provider.md`、`docs/feature/usage_metering.md`
- schema：`docs/technical/db_schema/USAGE_METERING_SCHEMA.MD`、`docs/technical/PROXY_POLICY_PROTOCOL.MD`
