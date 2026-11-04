# BILLING_QUOTA_REQ-011 开发记录（观察页筛选 + 余额 3 列布局）

> 对应需求：`docs/requirement/BILLING_QUOTA_REQ-011_FRONTEND_VIEW_FILTER.md`
> 对应计划：`docs/plan/BILLING_QUOTA_VIEW_FILTER_PLAN.md`
> 分支：`feat/billing-menu-split`

## 1. 实现摘要

「余额与流水」观察页新增三档筛选（全员 / 只看团队 / 某个成员），同时作用于余额卡片与流水表；余额卡片改为每行 3 个、超出换行。

- `pages/billing.tsx`：
  - 新增 `scope`（`all`/`team`/`member`）与 `memberId` 状态。
  - 范围 `Select` + （`member` 时）成员 `Select`（成员取 `memberAccounts`，即有独立账户的成员）。
  - 余额团队/成员卡片统一为 `visibleCards` 数组，按 scope 过滤后在 `grid grid-cols-1 gap-4 sm:grid-cols-3` 中渲染（每行 3 个、超出换行）。
  - 流水按 `accountType`/`userId` 客户端过滤后传给 `TransactionTable`。
  - 空态：无匹配卡片「暂无余额数据」；`member` 无成员账户「暂无成员账户」。

## 2. 代码改动点

### 修改

| 文件 | 说明 |
|---|---|
| `apps/portal-frontend/src/pages/billing.tsx` | 新增筛选状态与控件、余额统一 3 列网格、流水客户端过滤 |

## 3. 踩坑记录

1. **成员列表来源**：成员选择器取 `memberAccounts`（有独立账户的成员），与 REQ-010「只显示有账户的成员」决策一致；若取 `listMembers` 会列出无账户成员，与余额展示口径不一致。
2. **统一网格**：此前「团队余额 / 成员余额」两个分组各自成网格，无法满足「每行 3 个、整体换行」；改为单一 `visibleCards` 网格后天然满足。

## 4. 验证结果

- `pnpm --filter portal-frontend typecheck`：通过。
- `pnpm --filter portal-frontend lint`：通过（仅 2 条既有 warning，非本模块）。
- `pnpm --filter portal-frontend build`：通过。

## 5. 关联

- feature：`docs/feature/billing_quota.md`
- 上游：`docs/plan/BILLING_QUOTA_VIEW_FILTER_PLAN.md` §3
