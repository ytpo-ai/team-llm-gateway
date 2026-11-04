# BILLING_QUOTA_REQ-011 观察页筛选 + 余额 3 列布局

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/billing_quota.md` |
| 所属 plan | `docs/plan/BILLING_QUOTA_VIEW_FILTER_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/billing-menu-split` |
| 状态 | `done` |

## 2. 需求描述

### 背景
观察页已支持成员级粒度展示，但当账户较多时缺少按维度收敛的入口，且余额卡片布局不够紧凑。

### 目标
- 新增「全员 / 只看团队 / 某个成员」三档筛选，同时作用于余额卡片与流水表。
- 余额卡片改为每行 3 个、超出换行（`grid sm:grid-cols-3`），替代「团队/成员」分组。

### 验收条件
- [x] `pnpm --filter portal-frontend typecheck` / `lint` / `build` 通过。
- [x] 三档切换正确过滤余额卡片与流水表。
- [x] 余额卡片每行 3 个、超出换行。

## 3. 技术方案摘要
- `pages/billing.tsx`：新增 `scope`/`memberId` 状态与两个 `Select`（范围 + 成员）；余额团队/成员卡片统一为 `visibleCards` 渲染在 `grid sm:grid-cols-3`；流水按 `accountType`/`userId` 客户端过滤。
- 结构详见 `docs/plan/BILLING_QUOTA_VIEW_FILTER_PLAN.md` §3。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/BILLING_QUOTA_REQ-011_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
