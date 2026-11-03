# BILLING_QUOTA_REQ-003 前端额度看板

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/billing_quota.md` |
| 所属 plan | `docs/plan/BILLING_QUOTA_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/billing-quota-frontend` |
| 状态 | `done` |

## 2. 需求描述

### 背景
后端计费（REQ-001）与转发层限额联动（REQ-002）已就绪。现落地前端额度看板：团队/成员额度余额 + 流水列表 + 充值/调整表单，路由 `/billing` + 导航接入。

### 目标
- 新增 `features/billing/`（`types` + `api`）与 `pages/billing.tsx`。
- 余额卡片：团队余额 + 成员余额列表（RBAC：`member` 仅本人）。
- 流水列表：额度流水（类型/来源/金额/余额变化/时间），支持时间区间过滤。
- 充值/调整表单：`team_admin`/`finance` 可见，可对团队或指定成员充值/调整额度。
- 路由 `/billing` + `app-layout` 导航接入。

### 验收条件
- [x] `pnpm --filter portal-frontend dev` / `build` 通过。
- [x] 看板展示真实余额/流水，空态友好。
- [x] `team_admin`/`finance` 充值/调整闭环可用；`member` 仅见本人余额。

## 3. 技术方案摘要
- 复用 React + TanStack Query + shadcn/ui 既有模式（参考 `features/usage/`、`pages/dashboard.tsx`）。
- 轻量表单，无新增依赖。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/BILLING_QUOTA_REQ-003_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
