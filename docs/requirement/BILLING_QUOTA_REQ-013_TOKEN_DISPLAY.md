# BILLING_QUOTA_REQ-013 金额列追加 Token 数

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/billing_quota.md` |
| 所属 plan | `docs/plan/BILLING_QUOTA_TX_TOKEN_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/billing-menu-split` |
| 状态 | `done` |

## 2. 需求描述

### 背景
流水列表金额列当前只展示点数与折算货币金额，缺少用量 Token 数，不便于对照用量与扣费。

### 目标
- 金额列在点数后追加展示本次用量的 Token 数。
- 仅用量扣减流水（`deduction`/`usage`）有 Token 数；充值/调整为 `null` 不展示。

### 验收条件
- [x] 后端 `typecheck` / `test` / `lint` 通过。
- [x] 前端 `typecheck` / `lint` / `build` 通过。
- [x] 扣减流水金额列展示 Token 数，充值/调整不展示。

## 3. 技术方案摘要
- 后端 `QuotaTransaction` 新增 `totalTokens`（默认 `null`）；`DeductInput` 新增 `totalTokens?`；`deduct()` 落库并返回；proxy `recordUsage` 传入 `totalTokens`；`listTransactions` 透出。
- 前端 `QuotaTransaction` 新增 `totalTokens`；金额列点数后追加 Token 数（仅 `totalTokens > 0`）。
- 结构详见 `docs/plan/BILLING_QUOTA_TX_TOKEN_PLAN.md` §3。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/BILLING_QUOTA_REQ-013_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
