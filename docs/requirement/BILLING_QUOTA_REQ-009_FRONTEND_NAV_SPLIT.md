# BILLING_QUOTA_REQ-009 前端导航拆分（充值→系统设置 / 余额流水→观察）

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/billing_quota.md` |
| 所属 plan | `docs/plan/BILLING_QUOTA_MENU_SPLIT_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `main` |
| 状态 | `done` |

## 2. 需求描述

### 背景
「额度与计费」页面（`pages/billing.tsx`）同时承载充值/调整（写）与余额/流水（读）两类职责，且入口位于「LLM管理」。为让「系统操作」与「只读观察」职责分离、RBAC 边界清晰，将其拆分为两个页面并归入对应菜单。

### 目标
- 新增 `pages/quota-topup.tsx`（充值 / 调整额度），路由 `/quota-topup`，归入「系统设置」菜单（`team_admin`/`system` 可见）。
- 重构 `pages/billing.tsx`，仅保留余额卡片 + 额度流水（只读），归入「观察」菜单（全员可见）。
- 更新 `router.tsx`（新增 `/quota-topup`）与 `app-layout.tsx`（移除「LLM管理」下的「额度与计费」，分别在「系统设置」/「观察」新增入口）。
- 充值/调整成功后 `invalidateQueries(['billing'])`，使观察页余额/流水自动刷新。

### 验收条件
- [x] `pnpm --filter portal-frontend typecheck` 通过。
- [x] `pnpm --filter portal-frontend lint` 通过（无新增告警）。
- [x] `pnpm --filter portal-frontend build` 通过。
- [x] 「系统设置」菜单出现「额度充值 / 调整」（`team_admin`/`system`），「观察」出现「余额与流水」，且「LLM管理」不再有「额度与计费」。
- [x] 充值/调整提交后，观察页余额与流水刷新（`invalidateQueries(['billing'])`）。

## 3. 技术方案摘要
- 纯前端改动，复用 `@tanstack/react-query`、`features/billing/api.ts`、`features/teams/api.ts`、shadcn 组件。
- 充值页表单以内联 Card 承载（页面无列表主体），缺省团队 `user.teamId` → 首个团队；system 角色可下拉切换团队。
- 观察页保留余额卡片 + `TransactionTable`，移除充值按钮与弹窗。
- 结构详见 `docs/plan/BILLING_QUOTA_MENU_SPLIT_PLAN.md` §3。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/BILLING_QUOTA_REQ-009_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
