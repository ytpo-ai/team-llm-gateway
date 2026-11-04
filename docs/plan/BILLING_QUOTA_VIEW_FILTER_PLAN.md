# 计费观察页筛选开发计划（BILLING_QUOTA_VIEW_FILTER）

> 本 plan 固化「余额与流水」观察页的筛选与布局优化：新增「全员 / 只看团队 / 某个成员」三档筛选（同时作用于余额卡片与流水表），余额卡片改为每行 3 个、超出换行。
>
> - 上游决策：`docs/feature/billing_quota.md`、`docs/plan/BILLING_QUOTA_MEMBER_VIEW_PLAN.md`（成员视图对齐）
> - 定稿时间：2026-11-04
> - 状态：已完成

---

## 1. 需求背景

REQ-010 已让观察页体现成员级粒度（流水「账户」列 + 余额分组），但当团队/成员较多时，余额卡片与流水混排、缺少按维度收敛的入口，不便于快速聚焦「只看团队」或「只看某成员」。

## 2. 目标

1. 观察页新增筛选：`全员` / `只看团队` / `某个成员` 三档。
2. 筛选同时作用于余额卡片与流水表（前端客户端过滤，复用已拉取数据）。
3. 余额卡片改为统一 3 列网格（每行 3 个，超出换行），替代此前的「团队/成员」分组。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 筛选状态 | `scope: 'all' | 'team' | 'member'` + `memberId`（成员账户 `userId`） |
| 筛选控件 | shadcn `Select`：范围选择器 + （`member` 时）成员选择器（成员列表取 `memberAccounts`，即有独立账户的成员） |
| 余额过滤 | 团队卡片 + 成员卡片统一为 `visibleCards` 数组，按 scope 过滤后在一个 `grid sm:grid-cols-3` 中渲染 |
| 流水过滤 | 对 `listQuotaTransactions` 返回的 100 条按 `accountType`/`userId` 客户端过滤 |
| 空态 | 无匹配卡片时显示「暂无余额数据」；`member` 无成员账户时显示「暂无成员账户」 |
| 影响面 | 仅前端 `pages/billing.tsx`，不改后端/API |

## 4. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [BILLING_QUOTA_REQ-011](../requirement/BILLING_QUOTA_REQ-011_FRONTEND_VIEW_FILTER.md) | 前端：三档筛选 + 余额 3 列网格 | 前端 typecheck/lint/build 通过；三档切换正确过滤余额与流水；余额每行 3 个、超出换行 |

## 5. 里程碑

1. ✅ REQ-011 观察页筛选 + 布局（本文档拆解）。

## 6. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| C-01 | 成员列表范围 | 定稿：取 `memberAccounts`（有独立账户的成员），与 REQ-010 决策一致 |
| C-02 | 流水过滤方式 | 定稿：客户端过滤已拉取的 100 条（不新增后端参数） |

## 7. 关联

- 上游：`docs/plan/BILLING_QUOTA_MEMBER_VIEW_PLAN.md`
- feature：`docs/feature/billing_quota.md`
- requirement：见 §4
