# 用户 LLM 限制策略开发计划（BILLING_QUOTA_POLICY）

> 本 plan 落地 `docs/guide/LIMIT.md` 的策略化方案：把散落在 `Team` / `RoleTemplate` / `ApiKey` 的固定限制字段，重构为「策略集（PolicySet）+ 策略条目（PolicyEntry）」模型，统一范围限制与用量限制的表达、挂载与求值，并改造现有设置 UI。
>
> - 上游决策：`docs/guide/LIMIT.md`（策略模型）、`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-06/09/10）
> - 上游 plan：`docs/plan/TEAM_MANAGEMENT_OPTIMIZATION_PLAN.md`（角色B / 三级限额模型，本 plan 将其策略化）
> - 定稿时间：2026-11-03
> - 状态：已完成（done）

---

## 1. 需求背景

现有限制以固定字段散落三处：`Team.limitDaily/Weekly/Monthly`、`RoleTemplate.limitDaily/Weekly/Monthly + rateLimitPerMinute + providerIds + modelWhitelist`、`ApiKey.allowedModels + rateLimitPerMinute + maxTokens + limitDaily/Weekly/Monthly + providerIds`。求值链由 `ProxyService.enforceLimits()` 硬编码逐字段校验，能力仅覆盖 token（日/周/月/永久）与 request（仅分钟）。

问题：字段零散、无法复用（团队无法预设一套策略挂到多处）、缺并发/金额/软预警/小时窗口等维度。现落地策略化：统一「范围限制 + 用量限制」，团队可预设策略集挂载到团队/角色/Key，求值取最严、不放宽。

## 2. 目标

1. 新增 `PolicySet`（策略集）+ `PolicyEntry`（策略条目）数据模型，`Team`/`RoleTemplate`/`ApiKey` 通过 `policySetId` 引用挂载。
2. 重构转发层求值：`QuotaLimitService` → 通用策略求值引擎（token/request/concurrency/spend × 窗口 × block/warn，三级取最严 AND，范围白名单逐级交集）。
3. 一次性硬迁移：存量固定字段等价映射为策略集并挂载，删除旧字段。
4. 前端：新增策略管理页（策略集 CRUD + 条目编辑器）；改造角色/团队/Key 现有限制设置 UI 为「绑定策略集」。
5. Phase 2 预留：按模型限额、团队/角色级并发、warn 通知通道、`team_admin` 显式 override。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 策略集模型 | `PolicySet`：`tenantId + teamId`（`teamId=null` = 内置全局）+ `name/description` + `entries[]` + `providerIds/modelWhitelist`（范围限制）+ `builtIn` |
| 策略条目 | `PolicyEntry = { measure, window, limit, action }`；`measure ∈ token/request/concurrency/spend`，`window ∈ permanent/minute/hour/day/week/month`，`action ∈ block/warn`，`limit` 为 number（`0`/空 = 不限） |
| 挂载 | `Team.policySetId` / `RoleTemplate.policySetId` / `ApiKey.policySetId`（可空 = 不限）；成员限额只经角色下发，不设成员级覆盖 |
| 求值合并 | 团队→角色→Key 三级逐级 AND（取最严）；同主体「同 measure+window」多条取 min；范围限制（providerIds/modelWhitelist）逐级取交集 |
| token/spend/request(长窗口) | 聚合 `UsageLog`：`sumTokens`（token）/`sumCost`（spend，`cost=倍率×token`，点数为单位）/ `countRequests`（request 计数）按窗口 `since` 过滤 |
| request(分钟) | 复用 `RateLimitService` 内存滑动窗口 |
| concurrency | 仅 apikey 级，转发层内存计数（进请求 +1、结束 -1），单实例 |
| 动作 | `block` 超限返回 429；`warn` 本期仅记录事件（通知通道 Phase 2） |
| 迁移 | 一次性硬迁移脚本：固定字段 → 等价策略条目（见 §2 映射表）→ 建/复用 PolicySet → 挂载 `policySetId` → 删除旧字段 |
| 口径统一 | `spend` 与余额同口径（点数），复用 `multiplier × totalTokens`，不依赖 `BILLING_QUOTA_CURRENCY_RATE`（USD 展示后接） |

## 4. RBAC 设计

| 资源 | 读 | 写 |
|---|---|---|
| `policy-sets` | `team_admin`/`system`（`member` 只读自身生效策略的摘要） | `team_admin`/`system` |

- 策略求值仅在转发层进程内进行，不对外暴露。

## 5. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [BILLING_QUOTA_REQ-006](../requirement/BILLING_QUOTA_REQ-006_POLICY_MODEL.md) | 后端策略数据模型：`PolicySet`/`PolicyEntry` schema + CRUD API + DTO 校验 + 硬迁移脚本（映射→建策略→挂载→删旧字段） | `start:dev` 启动，Swagger 可调 `/policy-sets/*`，迁移脚本将存量字段等价转为策略并删除旧字段，lint/typecheck/test 通过 |
| [BILLING_QUOTA_REQ-007](../requirement/BILLING_QUOTA_REQ-007_POLICY_ENGINE.md) | 后端策略求值引擎：重构 `QuotaLimitService`/`ProxyService.enforceLimits`，通用策略求值 + 范围白名单 + 取最严 | 团队/角色/Key 三级策略正确拦截（token/request/concurrency/spend × 窗口），block/warn 生效，范围白名单交集正确，lint/typecheck/test 通过 |
| [BILLING_QUOTA_REQ-008](../requirement/BILLING_QUOTA_REQ-008_POLICY_UI.md) | 前端策略 UI：策略管理页（策略集 CRUD + 条目编辑器）+ 改造角色/团队/Key 限制设置 UI 为绑定策略集 | `dev`/`build` 通过，策略管理页可增删改策略集与条目，角色/团队/Key 页通过绑定策略集配置限制 |

## 6. 里程碑

1. ✅ REQ-006 策略数据模型 + 硬迁移。
2. ✅ REQ-007 策略求值引擎（转发层闭环）。
3. ✅ REQ-008 策略管理 UI + 现有限制 UI 改造。

## 7. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| P-01 | 策略存储 | 定稿：独立 `PolicySet` + `policySetId` 引用挂载 |
| P-02 | 迁移 | 定稿：一次性硬迁移（删旧字段），迁移脚本幂等 |
| P-03 | 成员覆盖 | 定稿：成员只经角色下发限制，不单独设置 |
| P-04 | spend 维度 | 定稿：点数为单位（`cost=倍率×token`），不依赖 currency rate；USD 展示后接 |
| P-05 | concurrency 范围 | Phase 1 仅 apikey 级（内存计数）；团队/角色级聚合 Phase 2 |
| P-06 | warn 动作 | Phase 1 仅记录事件；通知通道（站内/邮件/Webhook）Phase 2 |
| P-07 | 时间窗口 | 先取固定自然窗口（沿用 `startOfDay/Week/Month`），滚动窗口后续 |
| P-08 | 改动面 | 涉及 Team/RoleTemplate/ApiKey 三处 schema、quota-limit/proxy 求值、roles/team/api-keys 三处前端，需跑通全部 lint/typecheck/test 防回归 |

## 8. 关联

- 上游：`docs/guide/LIMIT.md`、`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`、`TEAM_MANAGEMENT_OPTIMIZATION_PLAN.md`
- feature：`docs/feature/billing_quota.md`、`docs/feature/team_member.md`、`docs/feature/api_key.md`
- 数据模型：`docs/technical/db_schema/BILLING_QUOTA_SCHEMA.MD`、`ROLE_TEMPLATE_SCHEMA.MD`、`API_KEY_SCHEMA.MD`、`TEAM_MEMBER_SCHEMA.MD`（本 plan 更新）
- requirement：见 §5
