# BILLING_QUOTA_REQ-001 后端计费与额度

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/billing_quota.md` |
| 所属 plan | `docs/plan/BILLING_QUOTA_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/billing-quota-backend` |
| 状态 | `done` |

## 2. 需求描述

### 背景
`usage_metering` 已交付 `UsageLog` 成本口径（`cost = multiplier × totalTokens`）。现落地「计费与额度」后端：`QuotaAccount` 额度账户（团队/成员）+ `QuotaTransaction` 额度流水 + 统一扣费引擎 `BillingService.deduct()` + 计费 API，为转发层联动（REQ-002）与前端看板（REQ-003）提供基础。

### 目标
- 新增 `QuotaAccount`、`QuotaTransaction` 数据模型（详见 `docs/technical/db_schema/BILLING_QUOTA_SCHEMA.MD`）。
- 新增 `billing` 模块：`BillingService`（充值/调整额度、余额/流水查询、统一扣费引擎 `deduct()`）+ `BillingController`（计费 API）。
- 扣费引擎：`deduct()` 按成员账户优先、团队账户回退解析目标账户，原子扣减（防负余额），不足截断并记 shortfall。
- 计费 API：`GET /billing/accounts`、`GET /billing/transactions`、`POST /billing/recharge`、`POST /billing/adjust`。
- RBAC：`member` 仅本人账户/流水；`team_admin`/`finance`/`viewer` 团队全量；`recharge`/`adjust` 仅 `team_admin`/`finance`。
- 租户/团队隔离：账户/流水按 `tenantId + teamId`（成员再叠加 `userId`）过滤。

### 验收条件
- [ ] `pnpm --filter portal-backend start:dev` 启动成功。
- [ ] Swagger 可调 `/billing/*` 各接口，充值→扣减→流水闭环正确。
- [ ] `member` 看不到他人账户/流水；`team_admin`/`finance` 可看团队全量并可充值/调整。
- [ ] `deduct()` 防负余额（并发下余额不 < 0）。
- [ ] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过。

## 3. 技术方案摘要
- 复用 Nest.js + Mongoose + Swagger 既有模式（参考 `apps/portal-backend/src/modules/usage/`、`api-keys/`）。
- 扣费原子性：读余额 → `$max` 聚合管道更新余额（`balance = max(balance - cost, 0)`）→ 记 `deduction` 流水。
- 数据模型与契约见 `docs/technical/db_schema/BILLING_QUOTA_SCHEMA.MD`、`docs/plan/BILLING_QUOTA_PLAN.md` §3/§4。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/BILLING_QUOTA_REQ-001_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
