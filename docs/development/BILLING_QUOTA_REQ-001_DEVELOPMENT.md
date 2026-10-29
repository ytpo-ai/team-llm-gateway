# BILLING_QUOTA_REQ-001 开发记录（后端计费与额度）

> 对应需求：`docs/requirement/BILLING_QUOTA_REQ-001_BACKEND_BILLING.md`
> 对应计划：`docs/plan/BILLING_QUOTA_PLAN.md`
> 分支：`main`

## 1. 实现摘要

落地「计费与额度」后端：`QuotaAccount` 额度账户（团队/成员）+ `QuotaTransaction` 额度流水 + 统一扣费引擎 `BillingService.deduct()` + 计费 API，为转发层联动（REQ-002）与前端看板（REQ-003）提供基础。

- 数据模型：`QuotaAccount`（`team`/`member` 两级，`balance` ≥ 0）、`QuotaTransaction`（`recharge`/`adjustment`/`deduction` + `source` 可插拔渠道 + `balanceAfter` 快照 + `shortfall`）。
- `BillingService.deduct()`：成员账户优先、团队账户兜底；`$max` 聚合管道更新余额防并发负余额，不足截断记 `shortfall`。
- `recharge`/`adjust`：可指定 `userId`（缺省=团队账户），正负调整，减额按 `min 0` 截断。
- RBAC：`member` 仅本人账户/流水；`team_admin`/`finance`/`viewer` 团队全量；`recharge`/`adjust` 仅 `team_admin`/`finance`（`@Roles()`）。
- 计费 API：`GET /billing/accounts`、`GET /billing/transactions`、`POST /billing/recharge`、`POST /billing/adjust`。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `modules/billing/schemas/quota-account.schema.ts` | `QuotaAccount` + `QuotaAccountType/Status` + 唯一索引 |
| `modules/billing/schemas/quota-transaction.schema.ts` | `QuotaTransaction` + 类型/来源枚举 + 时间序列索引 |
| `modules/billing/dto/recharge-quota.dto.ts` | `RechargeQuotaDto`（amount/userId/description） |
| `modules/billing/dto/adjust-quota.dto.ts` | `AdjustQuotaDto` |
| `modules/billing/dto/list-transactions-query.dto.ts` | `ListTransactionsQueryDto`（from/to/type） |
| `modules/billing/billing.service.ts` | 充值/调整/扣费引擎/余额流水查询 + RBAC scope |
| `modules/billing/billing.controller.ts` | `/billing/*` REST 接口 |
| `modules/billing/billing.module.ts` | 模块装配（forFeature 账户/流水/User） |
| `modules/billing/billing.service.spec.ts` | 单测（7 例） |

### 修改

| 文件 | 说明 |
|---|---|
| `app.module.ts` | 注册 `BillingModule` |

## 3. 踩坑记录

1. **防负余额用聚合管道**：`findOneAndUpdate({ _id }, [{ $set: { balance: { $max: [{ $subtract: ['$balance', n] }, 0] } } }])`，在管道里引用当前字段值，避免并发下读-改-写竞态导致余额为负。
2. **账户唯一性**：团队账户 `userId=null`、成员账户 `userId=ObjectId`，用 `{ tenantId, teamId, type, userId }` 复合唯一索引区分，避免 null 与缺失字段在 Mongo 唯一索引中的边界差异。
3. **扣费账户解析**：`resolveSpendableAccount` 先查成员账户、缺失回退团队账户，与「成员额度优先、团队兜底」的产品口径一致，避免重复扣两份。

## 4. 验证结果

- `pnpm --filter portal-backend lint`：0 errors / 0 warnings。
- `pnpm --filter portal-backend typecheck`：通过。
- `pnpm --filter portal-backend test`：61 passed（新增 billing 7 + rate-limit 3）。

## 5. 关联

- feature：`docs/feature/billing_quota.md`
- 数据模型：`docs/technical/db_schema/BILLING_QUOTA_SCHEMA.MD`
- 上游：`docs/plan/BILLING_QUOTA_PLAN.md` §3/§4
