# 渠道用量感知与自动 Fallback（PROVIDER_USAGE_SENSE）

> 本 plan 新增渠道上游用量感知能力：查询上游用量/限额数据，驱动转发层多渠道 fallback，并在前端展示渠道用量。
>
> - 上游 plan：`MODEL_MULTI_CHANNEL_PLAN.md`（多渠道绑定）、`USAGE_METERING_PLAN.md`（本地计量）、`BILLING_QUOTA_PLAN.md`（扣费引擎）
> - feature：`docs/feature/model_provider.md`、`docs/feature/usage_metering.md`
> - 定稿时间：2026-11-06
> - 状态：`done`

---

## 1. 需求背景

当前系统已实现模型多渠道绑定（`Model.providerBindings`），但存在两个关键缺口：

1. **转发层未做渠道 fallback**：`ProxyService.prepare()` 仅使用 `model.providerId`（主渠道），不遍历 `providerBindings` 尝试备用渠道。
2. **无法感知上游渠道用量/限额**：渠道对接的 LLM 账户可能被多个客户端共享使用（不仅是 gateway），仅靠本地 `UsageLog` 无法判断上游渠道是否已达限额（如 Kimi 5 小时额度用尽、API Key 速率超限）。

需要让 gateway 能查询上游渠道自身的使用量/限额数据，并据此在转发时自动跳过已耗尽的渠道、fallback 到下一优先级。

## 2. 目标

### 阶段 1：渠道用量数据模型 + 查询机制
1. `Provider` 新增可选 `usageEndpoint` 字段，标记上游用量查询 API
2. 上游用量查询抽象层：通过 `UpstreamAdapter` 扩展 `fetchUsage()` 方法，各适配器可选实现
3. 新增 `ProviderUsage` Schema 缓存上游用量快照
4. `ProviderUsageService` 负责查询、缓存、判尽（TTL 可配）

### 阶段 2：转发层渠道 Fallback
5. `ProxyService.prepare()` 改为按 `providerBindings` 优先级遍历候选渠道
6. 跳过已耗尽渠道（`ProviderUsage.isExhausted`）
7. 上游返回 429 时自动标记渠道暂时耗尽 + fallback 重试
8. 每次代理请求后从上游响应头提取用量/速率信息

### 阶段 3：前端展示
9. 渠道管理页增加"用量"列（上游用量/限额）
10. 用量看板增加"按渠道"拆分卡片

## 3. 技术方案要点

### 3.1 Provider Schema 扩展

| 字段 | 类型 | 说明 |
|---|---|---|
| `usageEndpoint` | string? | 上游用量查询 API URL，空表示不启用 |

### 3.2 ProviderUsage Schema（新增）

```
ProviderUsage {
  tenantId, teamId, providerId,
  quotaTotal: number | null,       // 总量（如 18000 秒 = 5h）
  quotaUsed: number | null,        // 已用量
  quotaUnit: 'token' | 'request' | 'second' | 'usd' | null,
  rateLimitRemaining: number | null,  // 速率剩余（来自响应头）
  rateLimitReset: Date | null,
  isExhausted: boolean,            // 综合判定：是否已耗尽
  errorMessage: string | null,     // 耗尽原因
  lastStatus: 'ok' | 'exhausted' | 'error',
  fetchedAt: Date,
}
```

### 3.3 UpstreamAdapter 扩展

```ts
interface UpstreamAdapter {
  // 现有方法保持不变
  // 新增可选方法：
  fetchUsage?(baseUrl: string, apiKey: string, usageEndpoint?: string): Promise<ProviderUsageSnapshot | null>;
}
```

- 返回 `null` 表示该适配器不支持用量查询（默认行为，向后兼容）
- 具体实现由各适配器按上游厂商 API 自行解析

### 3.4 转发层 Fallback 流程

```
1. 从 model.providerBindings 排优先级（升序）+ 主渠道兜底
2. 按优先级遍历候选渠道：
   a. 检查 Provider.status === 'active'
   b. 检查 ProviderUsage 快照：isExhausted → 跳过
   c. 尝试请求上游
   d. 成功 → 返回
   e. 429 → 标记耗尽，继续下一候选
   f. 其他错误 → 继续下一候选
3. 全部失败 → 返回 502
```

### 3.5 上游响应头用量提取

部分上游会在响应头中返回速率限制信息（如 `x-ratelimit-remaining-requests`），转发层在每次代理请求后提取并更新 `ProviderUsage` 快照。

## 4. 影响范围

### 后端

| 文件 | 改动 |
|---|---|
| `providers/schemas/provider.schema.ts` | 新增 `usageEndpoint` 字段 |
| `providers/dto/create-provider.dto.ts` | 新增 `usageEndpoint` 可选字段 |
| `providers/dto/update-provider.dto.ts` | 新增 `usageEndpoint` 可选字段 |
| `providers/providers.service.ts` | `toView()` 增加 `usageEndpoint` |
| `proxy/adapters/upstream-adapter.ts` | 新增 `ProviderUsageSnapshot` 类型、`fetchUsage()` 可选方法 |
| `usage/schemas/provider-usage.schema.ts` | **新增** ProviderUsage Schema |
| `usage/provider-usage.service.ts` | **新增** ProviderUsageService |
| `usage/usage.module.ts` | 注入 ProviderUsage Schema + Service |
| `proxy/proxy.service.ts` | 多渠道 fallback 逻辑 |
| `usage/usage.service.ts` | 新增 `byProvider()` 聚合查询 |
| `usage/usage.controller.ts` | 新增 `GET /usage/by-provider` |

### 前端

| 文件 | 改动 |
|---|---|
| `features/providers/types.ts` | Provider 增加 `usageEndpoint` |
| `features/providers/api.ts` | 新增 `getProviderUsage()` |
| `pages/providers.tsx` | 列表增加"用量"列 |
| `features/usage/api.ts` | 新增 `getUsageByProvider()` |
| `features/usage/types.ts` | 类型补充 |
| `pages/dashboard.tsx` | 增加"按渠道"拆分卡片 |

## 5. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [REQ-001](docs/requirement/PROVIDER_USAGE_REQ-001_BACKEND_SCHEMA_QUERY.md) | Provider Schema 扩展 + ProviderUsage Schema + ProviderUsageService | lint/typecheck 通过，可缓存上游用量快照 |
| [REQ-002](docs/requirement/PROVIDER_USAGE_REQ-002_BACKEND_FALLBACK.md) | 转发层多渠道 fallback + 429 处理 + 响应头提取 | 多渠道按优先级 fallback，429 自动切换 |
| [REQ-003](docs/requirement/PROVIDER_USAGE_REQ-003_BACKEND_BY_PROVIDER.md) | 用量 API 新增 by-provider 聚合 | `GET /usage/by-provider` 可用 |
| [REQ-004](docs/requirement/PROVIDER_USAGE_REQ-004_FRONTEND.md) | 前端：渠道管理用量列 + 用量看板按渠道拆分 | 渠道页可见上游用量，看板可按渠道拆分 |

## 6. 里程碑

1. ✅ REQ-001 数据模型 + 查询机制
2. ✅ REQ-002 转发层多渠道 fallback
3. ✅ REQ-003 by-provider 聚合 API
4. ✅ REQ-004 前端展示

## 7. 风险

| 编号 | 事项 | 状态 |
|---|---|---|
| R-01 | 各上游厂商用量 API 格式不统一，fetchUsage() 需逐家实现 | 首期提供通用机制 + 响应头提取，厂商专属实现在适配器中按需补充 |
| R-02 | 并发请求下渠道快照可能过时，导致短暂超额 | 快照 TTL 可配（默认 30s），429 实时捕获，风险可控 |
| R-03 | 多渠道 fallback 增加单次请求延迟 | 优先检查缓存快照（无网络 IO），仅在缓存过期时发起一次查询 |

## 8. 关联

- 上游：`MODEL_MULTI_CHANNEL_PLAN.md`、`USAGE_METERING_PLAN.md`、`BILLING_QUOTA_PLAN.md`
- feature：`docs/feature/model_provider.md`、`docs/feature/usage_metering.md`
- schema：`docs/technical/db_schema/MODEL_PROVIDER_SCHEMA.MD`、`docs/technical/db_schema/USAGE_METERING_SCHEMA.MD`