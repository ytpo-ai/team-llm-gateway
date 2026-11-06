# 渠道用量感知与多渠道 Fallback — 开发记录（PROVIDER_USAGE）

> 关联 Plan：`docs/plan/PROVIDER_USAGE_SENSE_PLAN.md`
>
> 完成时间：2026-11-06
>
> 实现摘要：为渠道增加上游用量感知能力，支持多渠道优先级 fallback，前端用量看板按渠道拆分。

---

## 1. 改动文件清单

### 后端新增

| 文件 | 说明 |
|---|---|
| `apps/portal-backend/src/modules/usage/schemas/provider-usage.schema.ts` | ProviderUsage Mongoose Schema（上游用量快照） |
| `apps/portal-backend/src/modules/usage/provider-usage.service.ts` | ProviderUsageService：查询、缓存、判尽、响应头提取 |

### 后端修改

| 文件 | 说明 |
|---|---|
| `providers/schemas/provider.schema.ts` | 新增 `usageEndpoint: string \| null` 字段 |
| `providers/dto/create-provider.dto.ts` | 新增 `usageEndpoint` 可选创建参数 |
| `providers/dto/update-provider.dto.ts` | 新增 `usageEndpoint` 可选更新参数 |
| `providers/providers.service.ts` | `toView()` / `create()` / `update()` 支持 `usageEndpoint` |
| `proxy/adapters/upstream-adapter.ts` | 新增 `ProviderUsageSnapshot` 类型 + `fetchUsage()` 可选方法 |
| `proxy/proxy.service.ts` | 多渠道 fallback 核心实现：`getProviderCandidates()`、`tryCandidate()`、`resolveModel()`、`extractRateLimitHeaders()`，四入口均支持 retry loop |
| `usage/usage.service.ts` | 新增 `byProvider()` 聚合查询；`breakdown()` 支持 `$providerId` |
| `usage/usage.controller.ts` | 新增 `GET /usage/by-provider` 端点 |
| `usage/usage.module.ts` | 注入 ProviderUsage + Provider Model |

### 前端

| 文件 | 说明 |
|---|---|
| `features/providers/types.ts` | Provider/Input/Patch 增加 `usageEndpoint` |
| `features/usage/api.ts` | 新增 `getUsageByProvider()` |
| `pages/dashboard.tsx` | 用量看板增加"按渠道"拆分卡片 |
| `pages/providers.tsx` | 渠道列表增加"用量探测"列 |

### 测试

| 文件 | 说明 |
|---|---|
| `proxy/proxy.service.spec.ts` | 新增 `ProviderUsageService` mock + `providerBindings` mock |
| `usage/usage.service.spec.ts` | 新增 `ProviderModel` mock |

---

## 2. 核心设计

### 2.1 多渠道 Fallback 流程

```
请求进入 → enforceLimits()  // 仅一次
         → resolveModel()    // 仅一次
         → getProviderCandidates()  // priority 升序
         → for each candidate:
            ├─ tryCandidate() → 检查 active / policy 允许 / isExhausted
            ├─ 转发 → success → extractRateLimitHeaders() → 返回
            ├─ 429 → markExhausted() → 下一候选
            └─ 5xx/408 → 下一候选
         → 全部失败 → 502
```

### 2.2 ProviderUsage 缓存机制

- `fetchAndCache()`: 通过 `UpstreamAdapter.fetchUsage()` 查询上游用量 API → upsert 到 `ProviderUsage`
- `getSnapshot()`: 取缓存快照，TTL 默认 30s（可配 `providerUsage.cacheTtlMs`）
- `isExhausted()`: 判断快照 `isExhausted`，过期视为未知返回 false（乐观）
- `markExhausted()`: 429 触发，标记 `isExhausted = true`
- `updateFromHeaders()`: 从上游响应头提取 `x-ratelimit-remaining-*` / `x-ratelimit-reset-*`

### 2.3 UpstreamAdapter 扩展

```ts
interface UpstreamAdapter {
  // 原有方法不变
  fetchUsage?(baseUrl, apiKey, usageEndpoint?): Promise<ProviderUsageSnapshot | null>;
}
```

返回 `null` 表示该适配器不支持用量查询（默认行为，向后兼容）。

---

## 3. 验证结果

- `pnpm run --filter portal-backend lint` ✅
- `pnpm run --filter portal-backend typecheck` ✅  
- `pnpm run --filter portal-backend test` ✅ (218 passed, 25 files)
- `pnpm run --filter portal-frontend build` ✅

---

## 4. 后续扩展

- 各适配器实现 `fetchUsage()`（Kimi / OpenAI / Anthropic 等厂商用量 API）
- 前端渠道详情页展示上游用量快照（额度总量/已用/剩余/速率）
- 团队/角色级 concurrency 在 gateway 侧聚合（当前仅 apikey 级）
- ProviderUsage 快照过期后的自动异步刷新