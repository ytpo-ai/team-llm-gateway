# 计费与额度数据模型（QuotaAccount / QuotaTransaction）

> 所属模块：`docs/feature/billing_quota.md`；上游 plan：`docs/plan/BILLING_QUOTA_PLAN.md`
>
> 本文件固化 `QuotaAccount`（额度账户）与 `QuotaTransaction`（额度流水）的 Mongoose Schema 定义，作为「计费与额度」模块的单一事实来源。上游依赖 `UsageLog` 的成本口径（`cost = multiplier × totalTokens`），下游被转发层（proxy）调用扣费。

---

## 1. 设计原则

- **多租户内建（ADR-03）**：账户/流水携带 `tenantId + teamId`，查询按租户/团队过滤。
- **额度账户两级（ADR-10）**：`team`（团队额度池）/ `member`（成员额度池）两种类型，团队级为兜底、成员级为可选上限。
- **统一扣费引擎（ADR-10）**：`deduct(cost)` 唯一扣费入口，`cost = multiplier × totalTokens`（与 `UsageLog` 同源）。
- **可插拔额度来源（ADR-10）**：`source` 标识来源渠道，首发 `recharge`/`manual`/`usage`，后续 `monthly`/`gift` 作为插件扩展。
- **只增不改审计流水**：`QuotaTransaction` 只追加，`balanceAfter` 固化每次变动后的余额快照。

## 2. QuotaAccount（额度账户）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `_id` | ObjectId | 主键 | 自动生成 |
| `tenantId` | ObjectId | 必填、ref `Tenant`、索引 | 所属租户 |
| `teamId` | ObjectId | 必填、ref `Team`、索引 | 所属团队 |
| `userId` | ObjectId | 可选、ref `User` | 成员账户归属成员；`null` = 团队账户 |
| `type` | enum | `team` / `member`，必填 | 账户类型 |
| `balance` | number | 必填、默认 `0`、`min 0` | 当前余额（额度点数） |
| `status` | enum | `active` / `frozen`，默认 `active` | 账户状态 |
| `createdAt` | Date | 自动 | 创建时间 |
| `updatedAt` | Date | 自动 | 更新时间 |

**索引**：
- 唯一索引 `{ tenantId: 1, teamId: 1, type: 1, userId: 1 }`：同一团队每种类型账户唯一（团队账户 `userId=null`，成员账户按 `userId` 唯一）。

## 3. QuotaTransaction（额度流水）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `_id` | ObjectId | 主键 | 自动生成 |
| `tenantId` | ObjectId | 必填、ref `Tenant`、索引 | 所属租户 |
| `teamId` | ObjectId | 必填、ref `Team`、索引 | 所属团队 |
| `userId` | ObjectId | 可选、ref `User` | 归属成员（团队级流水为 `null`） |
| `accountId` | ObjectId | 必填、ref `QuotaAccount`、索引 | 变动账户 |
| `accountType` | enum | `team` / `member`，必填 | 变动账户类型 |
| `type` | enum | `recharge` / `adjustment` / `deduction`，必填 | 流水类型 |
| `source` | enum | `recharge` / `manual` / `usage`，必填 | 额度来源标识（可插拔渠道） |
| `amount` | number | 必填、默认 `0` | 变动金额（入账为正、扣减为负） |
| `balanceAfter` | number | 必填、默认 `0`、`min 0` | 变动后余额快照 |
| `shortfall` | boolean | 可选、默认 `false` | 扣减是否因余额不足被截断 |
| `referenceId` | string | 可选 | 关联标识（`requestId` / 充值单号） |
| `description` | string | 可选 | 备注 |
| `createdAt` | Date | 自动 | 创建时间 |

**索引**：
- `{ tenantId: 1, createdAt: -1 }`：租户级流水时间序列。
- `{ tenantId: 1, teamId: 1, createdAt: -1 }`：团队级流水。
- `{ tenantId: 1, userId: 1, createdAt: -1 }`：成员级流水。
- `{ accountId: 1, createdAt: -1 }`：按账户追溯。

## 4. 扣费引擎契约（`BillingService.deduct`）

```ts
interface DeductInput {
  tenantId: string;
  teamId: string;
  userId: string;
  cost: number;          // cost = multiplier × totalTokens（与 UsageLog 同源）
  referenceId?: string;  // requestId
  description?: string;
}
```

**扣费账户解析规则**：
1. 查找该 `userId` 的 `member` 账户；存在 → 从成员账户扣。
2. 不存在 → 回退团队 `team` 账户扣（get-or-create）。

**原子性**：
- 读目标账户余额 → `balance = max(balance - cost, 0)` 聚合管道更新（防并发负余额）。
- 实际扣减额 `deducted = min(balance, cost)`；`deducted < cost` 时记 `shortfall: true`。
- 记 `deduction` 流水（`amount = -deducted`、`balanceAfter = balance - deducted`）。

**余额预检（转发前）**：`getSpendableBalance(tenantId, teamId, userId)` 返回解析后有效账户余额，`<= 0` 拒绝请求。

## 5. 充值 / 调整契约

```ts
interface TopupInput {
  amount: number;      // > 0
  userId?: string;     // 缺省 = 团队账户；指定 = 成员账户
  description?: string;
}

interface AdjustInput {
  amount: number;      // 可正可负（正=加额度，负=减额度）
  userId?: string;
  description?: string;
}
```

- `recharge`（`source: recharge`，`type: recharge`）：`amount > 0` 入账。
- `adjust`（`source: manual`，`type: adjustment`）：正负调整，减额时按 `min 0` 截断。

## 6. 状态流转

```
(充值/调整) ──► QuotaAccount.balance + ──► QuotaTransaction(recharge/adjustment)
                                              │
(转发层用量) ──► deduct() ──► QuotaAccount.balance - ──► QuotaTransaction(deduction)
```

- 账户只增/减余额，不物理删除；流水只追加。

## 7. 三级限额模型（团队管理优化 REQ-002）

余额（Quota）与限额（Limit）是两个独立维度，本模块只负责余额：

| 维度 | 说明 | 数据载体 |
|---|---|---|
| **余额账户** | 可消耗的资金，团队/成员两级 | `QuotaAccount`（`team`/`member`） |
| **限额（日/周/月）** | 使用上限，团队/成员/key 三级 | `Team.limitDaily/Weekly/Monthly`、`RoleTemplate`（成员继承）、`ApiKey.limitDaily/Weekly/Monthly` |

**限额生效规则**（转发层 `QuotaLimitService` + `ProxyService`）：
- 团队 / 成员（角色B 模板）/ key 三级**逐级独立校验**，任一级在对应窗口内累计 token 超过限额即拦截。
- 速率限制（`rateLimitPerMinute`）分两档独立校验：成员级（角色B 模板）以 `userId` 聚合计数（成员多 key 共享同一上限），key 级以 `apiKeyId` 计数。
- 渠道白名单：团队 / 成员 / key 三级 `providerIds` 逐级检查（非空白名单须包含目标渠道）。
- apikey **只设限额、不持余额**，扣费仍走成员优先、团队兜底的余额账户。
- 成员限额默认继承角色B 模板（本期不支持单成员覆盖，预留 override 扩展点）。
