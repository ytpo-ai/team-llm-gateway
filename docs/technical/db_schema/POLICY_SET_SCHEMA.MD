# 限制策略数据模型（PolicySet / PolicyEntry）

> 所属模块：`docs/feature/billing_quota.md`；上游 plan：`docs/plan/BILLING_QUOTA_POLICY_PLAN.md`
>
> 本文件固化 `PolicySet`（策略集）/ `PolicyEntry`（策略条目）的 Mongoose Schema 定义，作为「用户 LLM 限制策略」的单一事实来源。策略集通过 `policySetId` 挂载到 `Team` / `RoleTemplate` / `ApiKey`，统一「范围限制 + 用量限制」的表达、挂载与求值。

---

## 1. 设计原则

- **两类限制分开**：范围限制（`providerIds` / `modelWhitelist`，集合型白名单）与用量限制（`entries`，数值型上限）同存于策略集，但表达与求值分离。
- **多租户内建**：策略集携带 `tenantId + teamId`；`teamId = null` 为内置全局集（`builtIn = true`，全局共享、不可删）。
- **挂载而非内嵌**：`Team` / `RoleTemplate` / `ApiKey` 通过 `policySetId` 引用挂载，团队可预设一套策略挂到多处复用。
- **取最严、不放宽**：团队 → 角色 → key 三级逐级 AND；同主体「同 measure+window」取 min；范围白名单逐级交集。

## 2. PolicySet（策略集）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `_id` | ObjectId | 主键 | 自动生成 |
| `tenantId` | ObjectId | 可选、ref `Tenant`、索引、默认 `null` | 所属租户；内置集为 `null` |
| `teamId` | ObjectId | 可选、ref `Team`、索引、默认 `null` | 所属团队；内置集为 `null` |
| `name` | string | 必填、trim | 策略集名（如「研发默认」「VIP 客户」） |
| `description` | string | 默认 `''` | 说明 |
| `entries` | PolicyEntry[] | 默认 `[]`（内嵌子文档，`_id: false`） | 用量限制条目 |
| `providerIds` | ObjectId[] | 默认 `[]`、ref `Provider` | 范围限制：渠道白名单（空 = 全部） |
| `modelWhitelist` | string[] | 默认 `[]` | 范围限制：模型白名单（空 = 全部） |
| `builtIn` | boolean | 默认 `false` | 是否内置集（不可删） |
| `createdAt` | Date | 自动 | 创建时间 |
| `updatedAt` | Date | 自动 | 更新时间 |

**索引**：`{ tenantId: 1, teamId: 1 }`；查询 `list` 走 `{ $or: [{ builtIn: true }, { tenantId, teamId }] }`。

## 3. PolicyEntry（策略条目，五要素）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `measure` | enum | `token` / `request` / `concurrency` / `spend`，必填 | 计量维度 |
| `window` | enum | `permanent` / `minute` / `hour` / `day` / `week` / `month`，必填 | 时间窗口 |
| `limit` | number | 必填、`min 0` | 限值（`0`/空 = 不限） |
| `action` | enum | `block` / `warn`，必填 | 硬拦截 / 软预警 |

> `measure` 与 `window` 组合在同策略集内不允许重复（CRUD 校验）。

### 计量维度（measure）

| 维度 | 计数口径 | 限值单位 |
|---|---|---|
| `token` | 窗口内累计 `totalTokens` | 个 |
| `request` | 窗口内累计请求次数（`minute` 走内存滑动窗口） | 次 |
| `concurrency` | 瞬时并发中请求数（仅 apikey 级） | 路 |
| `spend` | 窗口内累计 `cost = multiplier × totalTokens` | 点数 |

## 4. 挂载关系

| 挂载目标 | 作用域 | 计数主体 |
|---|---|---|
| `Team.policySetId` | `team` | 全团队聚合（`teamId`） |
| `RoleTemplate.policySetId` | `role` | 绑定该角色的成员（`userId`） |
| `ApiKey.policySetId` | `key` | 单 key（`apiKeyId`） |

- `policySetId = null` = 不限。
- 成员限额只经角色模板下发，不提供成员级单独覆盖。

## 5. 求值规则（转发层）

- 团队 → 角色 → key 三级逐级 AND（各用独立聚合主体），任一级不满足即拦截。
- 同主体「同 measure+window」多条取最严（最小 limit 先触发）。
- 范围白名单 `providerIds` / `modelWhitelist` 逐级交集（非空白名单须包含目标）。
- `block` 超限返回 429；`warn` 仅记录事件不阻断。
- `token`/`spend`/`request`(长窗口) 聚合 `UsageLog`；`request`(minute) 复用内存滑动窗口；`concurrency` 仅 apikey 级内存计数。

## 6. 迁移映射

旧固定字段一次性硬迁移为策略集并挂载：

| 旧字段 | 新策略条目 / 字段 |
|---|---|
| `limitDaily/Weekly/Monthly` | `{ token, day/week/month, X, block }` |
| `rateLimitPerMinute` | `{ request, minute, X, block }` |
| `maxTokens` | `{ token, permanent, X, block }` |
| `providerIds` | `PolicySet.providerIds` |
| `modelWhitelist` / `allowedModels` | `PolicySet.modelWhitelist` |
