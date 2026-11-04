# 计费流水金额列展示 Token 数开发计划（BILLING_QUOTA_TX_TOKEN）

> 本 plan 固化「余额与流水」观察页金额列的小幅增强：在点数金额后追加展示本次用量的 Token 数。
>
> - 上游决策：`docs/feature/billing_quota.md`、`docs/plan/BILLING_QUOTA_TX_FILTER_PAGINATION_PLAN.md`（REQ-012）
> - 定稿时间：2026-11-05
> - 状态：已完成

---

## 1. 需求背景

「余额与流水」流水列表的金额列当前只展示点数（`amount`）与折算货币金额。用户希望在点数后追加展示该笔流水的 Token 数，便于直接对照用量与扣费。

## 2. 目标

1. 流水金额列在点数后展示 Token 数（仅用量扣减流水有值，充值/调整为 `null` 不展示）。
2. 补齐数据链路：`QuotaTransaction` 落库 `totalTokens`，前端透出展示。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 数据落库 | `QuotaTransaction` 新增 `totalTokens: number \| null`（默认 `null`），仅 `deduction`/`usage` 流水写入 |
| 扣费入参 | `DeductInput` 新增 `totalTokens?`，`deduct()` 落库并返回 |
| 调用链路 | proxy `recordUsage` 在 `deduct()` 时传入已计算的 `totalTokens` |
| 视图透出 | `QuotaTransactionView` / 前端 `QuotaTransaction` 新增 `totalTokens: number \| null` |
| 前端展示 | 金额列点数后追加 `<span>{totalTokens} Token</span>`，仅当 `totalTokens > 0` 显示 |
| 影响面 | 后端 schema / service / proxy + spec；前端 types / `pages/billing.tsx`；schema 文档 |

## 4. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [BILLING_QUOTA_REQ-013](../requirement/BILLING_QUOTA_REQ-013_TOKEN_DISPLAY.md) | 金额列追加 Token 数 | 前后端 typecheck/lint/test/build 通过；扣减流水展示 Token 数，充值/调整不展示 |

## 5. 里程碑

1. ✅ REQ-013 金额列 Token 数展示（本文档拆解）。

## 6. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| C-01 | 历史存量流水无 `totalTokens` | 定稿：`null`，不展示，不回填历史 |
| C-02 | 展示位置 | 定稿：点数后、货币金额前的独立小字行 |

## 7. 关联

- 上游：`docs/plan/BILLING_QUOTA_TX_FILTER_PAGINATION_PLAN.md`（REQ-012）
- feature：`docs/feature/billing_quota.md`
- requirement：见 §4
