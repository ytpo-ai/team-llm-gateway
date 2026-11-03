# 用户 LLM 限制策略优化

> 定位：把当前散落在 `Team` / `RoleTemplate` / `ApiKey` 中的限制字段，抽象为一套**可组合的策略层**，统一「范围限制 + 用量限制」的表达、挂载与合并规则，降低配置心智、支撑团队预设复用。
>
> 关联：`docs/technical/db_schema/API_KEY_SCHEMA.MD`、`ROLE_TEMPLATE_SCHEMA.MD`、`BILLING_QUOTA_SCHEMA.MD`、`TEAM_MEMBER_SCHEMA.MD`；上游决策 `docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-06/09/10）。

---

## 1. 目标

1. 用「策略条目」统一表达限制，替换四处硬编码字段（团队/角色/key 各自一套）。
2. 团队可**预设策略集**，一键挂载到 团队 / 角色模板 / apikey，避免重复配置。
3. 明确多策略叠加与跨层级的**合并规则**，保证转发层判定可预期、可审计。
4. 补齐现有缺口：并发数限制、软预警（warn）、spend 金额维度、小时窗口。

---

## 2. 核心概念：两类限制 + 一条边界

### 2.1 范围限制 vs 用量限制

限制分两类，本质不同，文档与实现均需分开处理：

| 类型 | 语义 | 现有字段 |
|---|---|---|
| **范围限制**（能访问什么） | 集合型白名单，命中即放行，未命中即拒绝 | `providerIds`（渠道）、`modelWhitelist` / `allowedModels`（模型） |
| **用量限制**（能用多少、多快） | 数值型上限，窗口内累计/瞬时计数比对 | `limitDaily/Weekly/Monthly`、`rateLimitPerMinute`、`maxTokens` |

- 范围限制随挂载目标一起下发，是「策略集」的一部分，但不用「条目」表达（它不是量）。
- 用量限制才抽象为「策略条目」。

### 2.2 余额（存量）vs 限额（周期上限）边界

两个维度独立，策略层只管「限额」，不碰「余额」：

| 维度 | 说明 | 数据载体 | 机制 |
|---|---|---|---|
| **余额账户** | 可消耗的存量资金，团队/成员两级 | `QuotaAccount.balance` | 充值/调整入账，转发层 `deduct(cost)` 扣减 |
| **限额（策略）** | 周期内累计使用上限 | 策略集（挂到 团队/角色/key） | 窗口内计数比对，超标 `block` 拦截或 `warn` 告警 |

- `spend` 维度虽与余额同口径（`cost = multiplier × totalTokens`），但它是**周期上限（只计数不扣钱）**，与余额账户的**扣费**互不干扰：一次调用既要过 `deduct` 余额预检，也要过所有 `spend` 限额比对。

---

## 3. 策略模型

### 3.1 策略条目（五要素）

```
策略条目 = { 作用域, 计量维度, 时间窗口, 限值, 动作 }
```

| 要素 | 取值 | 说明 |
|---|---|---|
| `作用域 scope` | `team` / `role` / `apikey` | 见 §4；由挂载目标决定 |
| `计量维度 measure` | `token` / `request` / `concurrency` / `spend` | 见 §3.2 |
| `时间窗口 window` | `permanent` / `minute` / `hour` / `day` / `week` / `month` | 见 §3.3 |
| `限值 limit` | number，`0`/空 = 不限 | 单位随 measure 而定 |
| `动作 action` | `block`（硬拦截）/ `warn`（软预警） | 见 §3.4 |

示例：

```
{ role, token,    month, 30_000_000, block }   // 每成员每月 3000 万 token
{ apikey, request, minute, 100, block }         // 每 key 每分钟 100 次
{ team, spend,    month, 300_000_000, warn }    // 团队月消费 300 元（点数）超了告警
{ apikey, concurrency, permanent, 5, block }    // 每 key 最多 5 路并发
```

### 3.2 计量维度（measure）

| 维度 | 计数口径 | 限值单位 | 现状 |
|---|---|---|---|
| `token` | 窗口内累计 `totalTokens`（输入+输出） | 个（整数） | 已有（日/周/月/永久） |
| `request` | 窗口内累计请求次数 | 次 | 已有（仅分钟级 RPM） |
| `concurrency` | 瞬时并发中请求数（非累计） | 路 | **缺失，本期补齐** |
| `spend` | 窗口内累计成本 `Σ(multiplier × totalTokens)` | 点数（内部），USD 仅展示 | 金额维度**本期补齐** |

- `concurrency` 计数是瞬时值、非窗口累计，与其余三维度量语义不同，实现时单独处理（进出请求时增减计数）。
- `concurrency` 本期仅支持 `apikey` 作用域；团队/角色级并发需跨 key 聚合，复杂度高，留 Phase 2。

### 3.3 时间窗口（window）

| 窗口 | 含义 | 现状 |
|---|---|---|
| `permanent` | 永久累计，不重置 | 已有（`maxTokens`） |
| `minute` | 自然分钟（滑动/固定窗口待定） | 已有（RPM） |
| `hour` | 自然小时 | **补齐** |
| `day` / `week` / `month` | 自然日/周/月 | 已有 |

- 窗口起始对齐方式（自然窗口固定 vs 滚动窗口）需在实现阶段定稿，建议与现有 `limitDaily` 的自然窗口语义保持一致，先取「固定自然窗口」。

### 3.4 动作（action）：软硬限额

| 动作 | 行为 | 说明 |
|---|---|---|
| `block` | 超标即拦截，返回限流错误 | 现有行为，硬上限 |
| `warn` | 超标不拦截，仅记录并触发告警 | **本期补齐**，支撑「额度预警」 |

- `warn` 不改变请求结果，但需：① 记录 `warn` 事件供审计；② 触发告警通知。
- 告警通道（站内信 / 邮件 / Webhook）本期先做「记录 + 可查询」，通知通道实现方式留 Phase 2 细化。

### 3.5 spend 维度与倍率折算

- 内部统一以**点数**计量：`cost = multiplier × totalTokens`，与 `UsageLog` / `BillingService` 同源同口径。
- 用户入参可用 USD（展示/录入），按可配置汇率折算为点数落库；汇率（如 `1 USD = 500000 点`）作为系统配置项，不做硬编码。
- 判定时按窗口内累计点数与限值比对，与余额扣费共用同一 `multiplier` 源，避免两套口径漂移。

---

## 4. 作用域与挂载

### 4.1 挂载目标

策略集（§6）挂载到三类目标，作用域由目标决定：

| 挂载目标 | 作用域 | 计数主体 | 对应现状 |
|---|---|---|---|
| 团队 | `team` | 全团队聚合 | `Team.limit*` |
| 角色模板 | `role` | 绑定该角色的每个成员（按 `userId` 聚合，多 key 共享） | `RoleTemplate`（成员继承） |
| apikey | `apikey` | 单 key（按 `apiKeyId`） | `ApiKey` |

- 成员限额**只通过角色模板**下发，不提供成员级单独设置。

### 4.2 继承链

```
团队(team) ──► 角色(role, 绑定成员) ──► apikey
```

- 成员限额仅来自角色模板，不单独设置；apikey 默认继承成员（角色）限制，可独立加严。
- 转发层按此链逐级校验，见 §5 合并规则。

---

## 5. 合并与放宽规则

**总原则：取最严（AND），只允许加严、不允许放宽。**

1. **同主体多条目**：同一作用域内多条策略全部生效；对「同 measure + 同 window」的条目取最严（限值最小者），不同 measure/window 互不影响。
2. **跨层级**：团队 → 角色 → 成员 → key 逐级校验，任一级不满足即拦截（等价于各级取交集、取最严）。
3. **范围限制**：`providerIds` / `modelWhitelist` 逐级取交集（非空白名单必须包含目标渠道/模型，否则拒绝）。
4. **不允许放宽**：apikey 不能设比角色/团队更松的限制；上层未限（`null`）时 key 可自行加严。
5. **速率双档**：成员级 `rateLimit`（`userId` 聚合）与 key 级 `rateLimit`（`apiKeyId`）独立校验，与现状一致。

> 设计取舍：禁止放宽换取「判定可预期 + 无越权」，与现有「key 只设限额」一致。若未来需要放宽，须引入 `team_admin` 显式 override + 审计，作为 Phase 2 扩展。

---

## 6. 策略预设（PolicySet）

团队（`team_admin`）可预置多个「策略集」，供重复挂载：

```
LimitPolicySet {
  tenantId, teamId,
  name,          // 如「研发默认」「VIP 客户」
  description,
  entries: LimitPolicyEntry[],   // 用量限制条目（§3.1）
  providerIds: ObjectId[],       // 范围限制：渠道白名单（空=全部）
  modelWhitelist: string[],      // 范围限制：模型白名单（空=全部）
  builtIn?: boolean,             // 内置集（tenantId/teamId = null）
  createdAt, updatedAt,
}
```

- 挂载关系：团队 → 团队默认策略集；角色模板 → 绑定一个策略集（成员继承）；apikey → 可选绑定策略集。
- 内置策略集（如「设计师」「开发人员」）全局共享、不可删，对应现有内置 `RoleTemplate` seed 逻辑。

---

## 7. 与现有字段映射

| 现有字段 | 策略化后 |
|---|---|
| `Team.limitDaily/Weekly/Monthly` | 团队策略集 `{token, day/week/month}` 条目 |
| `Team.providerIds` | 团队策略集 `providerIds` |
| `RoleTemplate.limitDaily/Weekly/Monthly` | 角色策略集 `{token, day/week/month}` 条目 |
| `RoleTemplate.rateLimitPerMinute` | 角色策略集 `{request, minute}` 条目 |
| `RoleTemplate.providerIds` / `modelWhitelist` | 角色策略集 `providerIds` / `modelWhitelist` |
| `ApiKey.limitDaily/Weekly/Monthly` / `maxTokens` | key 策略集 `{token, day/week/month/permanent}` 条目 |
| `ApiKey.rateLimitPerMinute` | key 策略集 `{request, minute}` 条目 |
| `ApiKey.providerIds` / `allowedModels` | key 策略集 `providerIds` / `modelWhitelist` |
| （无） | 新增 `{concurrency, permanent}` 条目、`{spend, *}` 条目、`{request, hour}` 条目 |

- **迁移策略**：策略层作为新配置模型，现有字段存量数据在实现时一次性映射为对应策略集（等价转换，语义不变）；`ApiKey.allowedModels` 与 `modelWhitelist` 命名统一。

---

## 8. 分阶段落地

**Phase 1（本期）**
- 策略条目四要素落地：`token` / `request` / `concurrency` / `spend` × 全窗口 × `block` / `warn`。
- 挂载目标：团队 / 角色 / apikey；策略集预设 + 内置集 seed。
- 合并规则「取最严、不放宽」在转发层 `QuotaLimitService` 统一实现。
- `spend` 维度 + USD 汇率换算；`concurrency` 仅 apikey 作用域。

**Phase 2**
- `team_admin` 显式 override 放宽 + 审计。
- 按模型粒度限额（`model_max_budget`，参考 LiteLLM）。
- 告警通知通道（站内/邮件/Webhook）+ 额度预警联动。
- 团队/角色级 `concurrency` 聚合。

---

## 9. 开放问题（待定）

- [ ] 时间窗口对齐：固定自然窗口 vs 滚动窗口（建议先固定自然窗口）。
- [ ] USD↔点数汇率默认值与管理入口。
- [ ] `warn` 告警的触发频控（避免重复告警风暴）。
- [ ] `request` 限流是否需要支持 `hour` 以上窗口（当前仅分钟级有现实意义）。
