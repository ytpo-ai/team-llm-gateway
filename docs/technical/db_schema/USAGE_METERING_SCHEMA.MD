# 计量与用量数据模型（UsageLog / ProviderUsage）

> 所属模块：`docs/feature/usage_metering.md`；上游 plan：`docs/plan/USAGE_METERING_PLAN.md`、`docs/plan/PROVIDER_USAGE_SENSE_PLAN.md`
>
> 本文件固化 `UsageLog`（请求级用量流水）与 `ProviderUsage`（上游渠道用量快照）的 Mongoose Schema 定义，作为「计量与用量」模块的单一事实来源。下游模块（billing_quota 扣费引擎、admin_overview 全局看板）引用此处的 token/成本/归属字段。

---

## 1. 设计原则

- **多租户内建（ADR-03）**：携带 `tenantId` + `teamId`，查询按租户/团队过滤。
- **四级归属（ADR-06）**：`tenantId → teamId → userId → apiKeyId`，支撑团队/成员/Key 三级聚合。
- **计量口径（ADR-10）**：`cost = multiplier × totalTokens`，`multiplier` 为请求发生时模型倍率的快照，保证历史账单不受后续倍率调整影响。
- **只读审计流水**：`UsageLog` 只增不改、不提供管理写接口，`record()` 由转发层进程内调用。
- **上报格式（D-05）**：`record()` 入参即本集合文档的必填字段子集。

## 2. UsageLog（请求级用量流水）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `_id` | ObjectId | 主键 | 自动生成 |
| `tenantId` | ObjectId | 必填、ref `Tenant`、索引 | 所属租户 |
| `teamId` | ObjectId | 必填、ref `Team`、索引 | 所属团队 |
| `userId` | ObjectId | 必填、ref `User`、索引 | 归属成员 |
| `apiKeyId` | ObjectId | 必填、ref `ApiKey`、索引 | 使用的成员 key |
| `providerId` | ObjectId | 必填、ref `Provider`、索引 | 命中的上游渠道 |
| `modelId` | string | 必填、trim | 命中的模型标识（解析后的 `modelId`） |
| `requestId` | string | 必填、索引 | 请求唯一标识（转发层生成/透传） |
| `status` | enum | `success` / `error`，默认 `success` | 请求结果 |
| `promptTokens` | number | 必填、默认 `0`、`min 0` | 输入 token |
| `completionTokens` | number | 必填、默认 `0`、`min 0` | 输出 token |
| `totalTokens` | number | 必填、默认 `0`、`min 0` | 总 token（= prompt + completion） |
| `multiplier` | number | 必填、默认 `1`、`min 0` | 倍率快照 |
| `cost` | number | 必填、默认 `0`、`min 0` | 成本 = `multiplier × totalTokens` |
| `scenario` | string | 可选 | 场景标签（供「按场景拆分」预留，默认 `null`） |
| `latencyMs` | number | 可选、`min 0` | 上游耗时（默认 `null`） |
| `createdAt` | Date | 自动 | 创建时间（计量时间） |

## 3. 索引

- `{ tenantId: 1, createdAt: -1 }`：租户级时间序列查询。
- `{ tenantId: 1, teamId: 1, createdAt: -1 }`：团队级趋势。
- `{ tenantId: 1, userId: 1, createdAt: -1 }`：成员级聚合。
- `{ tenantId: 1, apiKeyId: 1, createdAt: -1 }`：Key 级聚合。
- `{ tenantId: 1, modelId: 1, createdAt: -1 }`：模型级聚合。
- `{ requestId: 1 }`：请求去重/追溯。

## 4. 上报契约（`UsageService.record`）

```ts
interface UsageRecordInput {
  tenantId: string;
  teamId: string;
  userId: string;
  apiKeyId: string;
  providerId: string;
  modelId: string;
  requestId: string;
  status: 'success' | 'error';
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  multiplier: number;
  cost: number;
  scenario?: string | null;
  latencyMs?: number | null;
}
```

- `cost` 由调用方（转发层）按 `multiplier × totalTokens` 计算后传入，`UsageService` 落库不重算（快照一致性）。
- 不校验业务幂等，`requestId` 仅作追溯索引。

## 5. 聚合查询输出（View）

```ts
interface UsageSummary {
  from: Date;
  to: Date;
  requestCount: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
}

interface UsageTrendPoint {
  bucket: string;         // 时间桶（ISO 时间，粒度 day/hour）
  requestCount: number;
  totalTokens: number;
  totalCost: number;
}

interface UsageBreakdownItem {
  id: string;             // modelId / userId / apiKeyId / providerId
  label?: string;         // 展示名（成员名/模型 displayName/渠道名，可选补全）
  requestCount: number;
  totalTokens: number;
  totalCost: number;
}
```

- 聚合均通过 MongoDB aggregation pipeline（`$match` + `$group` + `$sort`）实现，初期不引时序库（ADR-06）。
- 新增 `$providerId` 聚合分组，支持按上游渠道拆分。

## 6. 状态流转

```
（转发层请求成功/失败）──► record() ──► UsageLog 落库（只增不改）
```

- 无删除/更新语义，审计流水只追加。

## 7. ProviderUsage（上游渠道用量快照）

> 关联 plan：`docs/plan/PROVIDER_USAGE_SENSE_PLAN.md`（阶段 1）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `_id` | ObjectId | 主键 | 自动生成 |
| `tenantId` | ObjectId | 必填、ref `Tenant`、索引 | 所属租户 |
| `teamId` | ObjectId | 必填、ref `Team`、索引 | 所属团队 |
| `providerId` | ObjectId | 必填、ref `Provider`、唯一索引的一部分 | 归属上游渠道 |
| `quotaTotal` | number | 可选、默认 `null` | 上游总量（秒/token/请求/USD） |
| `quotaUsed` | number | 可选、默认 `null` | 上游已用量 |
| `quotaUnit` | enum | `token` / `request` / `second` / `usd`，默认 `null` | 用量单位 |
| `rateLimitRemaining` | number | 可选、默认 `null` | 速率剩余（来自上游响应头） |
| `rateLimitReset` | Date | 可选、默认 `null` | 速率重置时间 |
| `isExhausted` | boolean | 默认 `false` | 综合判定：是否已耗尽 |
| `errorMessage` | string | 可选、默认 `null` | 耗尽/错误原因 |
| `lastStatus` | enum | `ok` / `exhausted` / `error`，默认 `ok` | 最近查询状态 |
| `fetchedAt` | Date | 必填 | 快照时间 |

**索引**：
- 唯一索引 `{ tenantId: 1, teamId: 1, providerId: 1 }`：每团队每渠道一份快照。
- 普通索引 `{ fetchedAt: 1 }`：按快照时间清理过期数据。

**机制**：
- `ProviderUsageService.fetchAndCache()`：通过 `UpstreamAdapter.fetchUsage()` 查询上游用量 API 并缓存。
- 缓存 TTL 可配（默认 30s），过期后下次请求触发重新查询。
- 429 响应自动标记 `isExhausted = true`，后续请求跳过该渠道。
- `updateFromHeaders()`：从上游响应头提取速率信息更新快照。
