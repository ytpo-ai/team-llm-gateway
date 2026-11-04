# 计费观察页筛选合并 + 流水分页开发计划（BILLING_QUOTA_TX_FILTER_PAGINATION）

> 本 plan 固化「余额与流水」观察页的两项交互优化：① 将 REQ-011 的两个筛选下拉合并为**单个下拉**（全员 / 只看团队 / 成员列表）；② 流水列表从「最近 100 条一次性加载」改为**服务端分页**。
>
> - 上游决策：`docs/feature/billing_quota.md`、`docs/plan/BILLING_QUOTA_VIEW_FILTER_PLAN.md`（REQ-011 双下拉 + 布局）
> - 定稿时间：2026-11-05
> - 状态：已完成

---

## 1. 需求背景

REQ-011 已落地「全员 / 只看团队 / 某个成员」筛选与余额 3 列布局，但存在两点体验问题：

1. 筛选用了**两个下拉框**（范围 + 成员），操作割裂，用户希望合并为一个下拉（内含「全员 / 只看团队 / 成员列表」分组）。
2. 流水一次性返回最近 100 条、无分页，流水较多时不便于浏览。

## 2. 目标

1. 筛选合并为**单个下拉框**：`全员` / `只看团队` / 成员列表（成员用分组展示）。
2. 流水列表改为**服务端分页**，默认每页 20 条，支持上一页 / 下一页。
3. 筛选与分页联动：切换筛选重置到第 1 页。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 筛选状态 | 单一 `filter: 'all' | 'team' | <成员userId>`，替代原 `scope` + `memberId` 双状态 |
| 筛选控件 | 单个 shadcn `Select`；成员项用 `SelectGroup` + `SelectLabel` 分组 |
| 余额过滤 | 与 REQ-011 相同：团队卡片 + 成员卡片统一 `visibleCards`，按 `filter` 过滤后渲染 `grid sm:grid-cols-3` |
| 流水分页 | 后端 `listTransactions` 改为返回 `{ items, total, limit, offset }`；前端 `PAGE_SIZE = 20`，`keepPreviousData` 平滑切换 |
| 后端过滤 | `listTransactions` 新增 `accountType` / `userId` 过滤（`filter` 映射为对应查询参数）；RBAC 过滤逻辑不变 |
| 分页参数 | `limit`（默认 20，`@Min(1) @Max(200)`）、`offset`（默认 0），复用 audit-logs 的 `countDocuments` + `skip/limit` 模式 |
| 影响面 | 后端 `billing.service.ts`、`dto/list-transactions-query.dto.ts`、spec；前端 `pages/billing.tsx`、`features/billing/api.ts`、`types.ts` |

## 4. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [BILLING_QUOTA_REQ-012](../requirement/BILLING_QUOTA_REQ-012_FILTER_PAGINATION.md) | 前端单下拉筛选 + 后端流水分页 | 前后端 typecheck/lint/test/build 通过；单下拉正确过滤余额与流水；分页正确（含筛选切换重置） |

## 5. 里程碑

1. ✅ REQ-012 筛选合并 + 流水分页（本文档拆解）。

## 6. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| C-01 | 分页页大小 | 定稿：`PAGE_SIZE = 20`，与后端默认 `limit=20` 一致 |
| C-02 | 余额是否分页 | 定稿：余额卡片仍为全量客户端过滤（账户数量有限），仅流水分页 |
| C-03 | 筛选→分页联动 | 定稿：切换筛选 `setOffset(0)` 重置到第 1 页 |

## 7. 关联

- 上游：`docs/plan/BILLING_QUOTA_VIEW_FILTER_PLAN.md`（REQ-011）
- feature：`docs/feature/billing_quota.md`
- requirement：见 §4
