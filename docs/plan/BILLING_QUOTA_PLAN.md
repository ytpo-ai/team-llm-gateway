# 计费与额度开发计划（BILLING_QUOTA）

> 本 plan 固化 Portal 业务模块 **计费与额度（billing_quota）** 的工程方案，落地 ADR-10「统一扣费引擎 + 可插拔额度来源」，并闭环 USAGE_METERING U-01「`rateLimitPerMinute` / `maxTokens` 实时校验」。
>
> - 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-03/06/10、§5.2、§7.2、D-03）
> - 上游 plan：`docs/plan/USAGE_METERING_PLAN.md`（计量流水 + 转发层已交付，本 plan 复用其 `UsageLog` 成本口径与转发链路）
> - 定稿时间：2026-10-29
> - 状态：已批准

---

## 1. 需求背景

`usage_metering` 已交付请求级用量流水（`cost = multiplier × totalTokens`）与 OpenAI 兼容转发层。但「额度账户 + 统一扣费引擎 + 可插拔额度来源」尚未落地，`ApiKey.rateLimitPerMinute` / `maxTokens` 的实时校验亦被后置（USAGE_METERING U-01）。现落地「计费与额度」：额度账户（团队级/成员级）+ 可插拔额度来源（首发充值/手动调整）+ 统一扣费引擎，并在转发层闭环限额校验与扣费。

## 2. 目标

1. 新增 `QuotaAccount`（额度账户：`team`/`member`）与 `QuotaTransaction`（额度流水），详见 `docs/technical/db_schema/BILLING_QUOTA_SCHEMA.MD`。
2. 计费服务 `BillingService`：充值/调整额度（可插拔额度来源接口，首发 `recharge`/`manual`）、余额/流水查询、统一扣费引擎 `deduct()`（倍率×token 原子扣减，防负余额）。
3. 计费 API：`GET /billing/accounts`、`GET /billing/transactions`、`POST /billing/recharge`、`POST /billing/adjust`。
4. 转发层联动：转发前校验 `rateLimitPerMinute`（内存滑动窗口）、`maxTokens`（累计 token 预算）、额度余额>0；转发后按实际 `cost` 扣减并落流水（闭环 U-01）。
5. 前端：额度看板（账户余额 + 流水 + 充值/调整表单），路由 `/billing` + 导航接入。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 数据模型 | 新增 `QuotaAccount` + `QuotaTransaction` 集合；详见 `docs/technical/db_schema/BILLING_QUOTA_SCHEMA.MD` |
| 扣费口径 | `deduct(cost)` 统一按 `cost = multiplier × totalTokens`（复用 `UsageLog` 成本快照，与计量同源） |
| 扣费账户解析 | 成员有 `member` 账户 → 从成员账户扣；否则回退团队 `team` 账户扣。充值/调整可指定 `userId`（缺省=团队账户） |
| 扣费原子性 | 读余额 → `$max` 聚合管道更新余额（防并发负余额）→ 记 `deduction` 流水；不足则按剩余额度截断并记 shortfall |
| 额度来源（可插拔） | `QuotaSource` 抽象，首发实现 `recharge`（充值入账）/ `manual`（手动调整）；`monthly`/`gift` 后置（D-03 首发清单） |
| 速率限制 | `RateLimitService`：内存滑动窗口计数（单实例），超限返回 429 |
| token 预算 | `maxTokens`：转发前聚合 `UsageLog` 该 key 累计 token，超限返回 429（初期聚合，量大后再引计数表） |
| 团队隔离 | 账户/流水携带 `tenantId + teamId`（成员再叠加 `userId`），查询按租户/团队过滤 |
| 鉴权 | 复用 `JwtAuthGuard`/`RolesGuard`/`@Roles()`/`@CurrentUser()`；RBAC 见 §4 |

## 4. RBAC 设计

| 资源 | 读 | 写 |
|---|---|---|
| `billing` 账户/流水 | `member` 仅本人；`team_admin`/`finance`/`viewer` 团队全量 | `recharge`/`adjust`：`team_admin`/`finance` |

- `deduct()` 仅转发层进程内调用（同 `UsageService.record()`），不对外暴露写接口。
- 额度流水为审计记录，只增不改。

## 5. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [BILLING_QUOTA_REQ-001](../requirement/BILLING_QUOTA_REQ-001_BACKEND_BILLING.md) | 后端计费：`QuotaAccount`/`QuotaTransaction` schema + `BillingService`（充值/调整 + `deduct()` 扣费引擎 + 余额/流水查询）+ 计费 API + 单测 | `start:dev` 启动，Swagger 可调 `/billing/*`，充值→扣减→流水闭环正确，lint/typecheck/test 通过 |
| [BILLING_QUOTA_REQ-002](../requirement/BILLING_QUOTA_REQ-002_BACKEND_PROXY_ENFORCEMENT.md) | 转发层联动：`RateLimitService`（速率）+ `maxTokens` 预算 + 额度余额预检 + 转发后扣减 + 单测 | 成员 key 超限/超预算/余额不足被拒绝，成功请求按成本扣减，lint/typecheck/test 通过 |
| [BILLING_QUOTA_REQ-003](../requirement/BILLING_QUOTA_REQ-003_FRONTEND_BILLING.md) | 前端额度看板：账户余额 + 流水列表 + 充值/调整表单 + 路由 `/billing` + 导航 | `dev`/`build` 通过，看板展示真实余额/流水，充值/调整闭环可用 |

## 6. 里程碑

1. ⬜ REQ-001 后端计费（本文档拆解）。
2. ⬜ REQ-002 转发层限额联动（闭环 USAGE_METERING U-01）。
3. ⬜ REQ-003 前端额度看板。

## 7. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| B-01 | 额度来源首发清单（D-03） | 本 plan 定稿：首发 `recharge`（充值）+ `manual`（调整）；`monthly`/`gift`/兑换码后置为插件 |
| B-02 | 速率限制实现 | 首期内存滑动窗口（单实例），分布式中转后置为 Redis/集中计数 |
| B-03 | `maxTokens` 累计口径 | 首期聚合 `UsageLog`（按 apiKeyId 索引），量大后再引独立计数表 |
| B-04 | 扣费与响应时序 | 首期「转发前预检余额>0 + 转发后按实际成本扣减」，不足截断记 shortfall；预授权/冻结额度后置 |
| B-05 | 扣费失败（余额不足以覆盖整笔成本） | 截断扣至 0 并记 `shortfall` 标记，不阻断已产生的用量流水 |

## 8. 关联

- 上游：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`、`USAGE_METERING_PLAN.md`、`API_KEY_PLAN.md`
- feature：`docs/feature/billing_quota.md`
- 数据模型：`docs/technical/db_schema/BILLING_QUOTA_SCHEMA.MD`（本 plan 新增）
- requirement：见 §5
