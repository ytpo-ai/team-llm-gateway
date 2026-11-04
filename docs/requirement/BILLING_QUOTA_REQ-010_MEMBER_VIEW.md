# BILLING_QUOTA_REQ-010 余额/流水成员级视图对齐

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/billing_quota.md` |
| 所属 plan | `docs/plan/BILLING_QUOTA_MEMBER_VIEW_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/billing-menu-split` |
| 状态 | `done` |

## 2. 需求描述

### 背景
充值已支持给指定成员单独充值（成员账户），但观察页的流水无法追溯成员归属、余额分组不清晰，且 `listTransactions` 对 `system` 角色的过滤与 `listAccounts` 不一致。

### 目标
- 后端 `listTransactions` 返回补 `label`（成员名）与 `teamName`（团队名）。
- 后端修复 `system` 角色过滤：与 `listAccounts` 对齐，system 看租户全量流水。
- 前端流水表新增「账户」列（团队 · 团队名 / 成员 · 成员名）。
- 前端余额区按「团队余额 / 成员余额」分组（成员余额仅显示有独立账户的成员）。

### 验收条件
- [x] `pnpm --filter portal-backend typecheck` 通过。
- [x] `pnpm --filter portal-backend lint` 通过。
- [x] `pnpm --filter portal-backend test` 通过（新增 `listTransactions` 5 条用例）。
- [x] `pnpm --filter portal-frontend typecheck` / `lint` / `build` 通过。
- [x] 流水表区分团队/成员交易；system 可见租户全量流水。

## 3. 技术方案摘要
- 后端：`QuotaTransactionView` 增 `label`/`teamName`；`listTransactions` 按 `accountType` 解析成员名、按 `teamId` 解析团队名；过滤改为 `member`→`userId`、`team_admin`→`teamId`、`system`→租户全量。
- 前端：`QuotaTransaction` 类型增 `label`/`teamName`；流水表加「账户」列；余额区拆两组。
- 结构详见 `docs/plan/BILLING_QUOTA_MEMBER_VIEW_PLAN.md` §3。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/BILLING_QUOTA_REQ-010_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
