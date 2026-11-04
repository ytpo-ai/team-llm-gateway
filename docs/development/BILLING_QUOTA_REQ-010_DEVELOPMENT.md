# BILLING_QUOTA_REQ-010 开发记录（余额/流水成员级视图对齐）

> 对应需求：`docs/requirement/BILLING_QUOTA_REQ-010_MEMBER_VIEW.md`
> 对应计划：`docs/plan/BILLING_QUOTA_MEMBER_VIEW_PLAN.md`
> 分支：`feat/billing-menu-split`

## 1. 实现摘要

让「余额 + 流水」观察页体现成员级粒度：流水补成员归属、余额按团队/成员分组，并修复 system 角色流水过滤与 `listAccounts` 不一致的问题。

- 后端 `billing.service.ts`：
  - `QuotaTransactionView` 增 `label`/`teamName` 字段。
  - `listTransactions` 过滤改为 `member`→`userId`、`team_admin`→`teamId`、`system`→租户全量（不再 `else` 分支把 system 也按 teamId 过滤）。
  - `listTransactions` 结果 enrich：`accountType==='member'` 的行按 `userId` 解析成员名，所有行按 `teamId` 解析团队名（复用 `buildLabelMap`/`buildTeamNameMap`）。
  - `deduct` 返回值补 `label: null`/`teamName: null`（保持 `QuotaTransactionView` 结构一致）。
- 前端 `features/billing/types.ts`：`QuotaTransaction` 增 `label`/`teamName`。
- 前端 `pages/billing.tsx`：流水表新增「账户」列（团队 · 团队名 / 成员 · 成员名）；余额区拆「团队余额」「成员余额」两个分组（成员余额为空不渲染）。
- 后端 `billing.service.spec.ts`：新增 `listTransactions` 5 条用例（member/team_admin/system 过滤 + 成员/团队账户 label 解析）。

## 2. 代码改动点

### 修改

| 文件 | 说明 |
|---|---|
| `apps/portal-backend/src/modules/billing/billing.service.ts` | 流水 enrich `label`/`teamName` + 修复 system 过滤 |
| `apps/portal-backend/src/modules/billing/billing.service.spec.ts` | 新增 `listTransactions` 5 条用例 |
| `apps/portal-frontend/src/features/billing/types.ts` | `QuotaTransaction` 增 `label`/`teamName` |
| `apps/portal-frontend/src/pages/billing.tsx` | 流水「账户」列 + 余额分组 |

## 3. 踩坑记录

1. **团队账户扣减也带 `userId`**：`deduct` 对团队账户同样写入 `userId`（消费人）。若按 `row.userId` 解析成员名会把团队账户交易误标为某成员，故「账户」归属以 `accountType` 为准：仅 `accountType==='member'` 才解析成员名。
2. **system 过滤空 teamId**：原 `else` 分支对 system 执行 `new Types.ObjectId(user.teamId)`，system 的 teamId 常为 `''`，会导致无效 ObjectId。改为 system 不按 teamId 过滤（租户全量），与 `listAccounts` 语义对齐。

## 4. 验证结果

- `pnpm --filter portal-backend typecheck`：通过。
- `pnpm --filter portal-backend lint`：通过。
- `pnpm --filter portal-backend test`：195 passed（含新增 5 条）。
- `pnpm --filter portal-frontend typecheck` / `lint` / `build`：通过。

## 5. 关联

- feature：`docs/feature/billing_quota.md`
- 上游：`docs/plan/BILLING_QUOTA_MEMBER_VIEW_PLAN.md` §3
