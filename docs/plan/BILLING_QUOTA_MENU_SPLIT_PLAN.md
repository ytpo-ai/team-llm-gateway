# 计费导航拆分开发计划（BILLING_QUOTA_MENU_SPLIT）

> 本 plan 固化「额度与计费」页面的导航职责拆分：将**充值/调整额度（系统操作级行为）**归入「系统设置」菜单，将**余额 + 流水展示（只读观察）**归入「观察」菜单，使操作与观察职责分离、RBAC 边界更清晰。
>
> - 上游决策：`docs/feature/billing_quota.md`（统一扣费引擎 + 可插拔额度来源）、`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-10）
> - 上游 plan：`docs/plan/BILLING_QUOTA_PLAN.md`（额度账户 + 扣费引擎）、`docs/plan/BILLING_QUOTA_CURRENCY_RATE_PLAN.md`（货币展示）
> - 定稿时间：2026-11-04
> - 状态：已完成

---

## 1. 需求背景

当前 `pages/billing.tsx`（路由 `/billing`，导航位于「LLM管理」下的「额度与计费」）同时承载三类职责：

1. **充值 / 调整额度**：`team_admin` / `system` 可见的系统操作（弹窗 + 表单，调 `POST /billing/recharge` / `POST /billing/adjust`）。
2. **余额卡片**：团队 / 成员额度余额（`member` 仅本人）。
3. **额度流水**：最近 100 条变动记录（只读）。

三者语义不同：充值/调整是**系统操作级写行为**，余额/流水是**只读观察**。混在同一菜单与页面中，导致「观察」与「系统设置」的职责边界模糊，`member` 等只读角色也会看到「额度与计费」入口（虽然按钮被 RBAC 隐藏，但入口语义不清）。

## 2. 目标

1. 将**充值 / 调整额度**拆分到独立页面，并归入「系统设置」菜单（`team_admin`/`system` 可见）。
2. 将**余额 + 流水展示**保留为只读页面，并归入「观察」菜单（全员可见，`member` 仅本人）。
3. 从「LLM管理」中移除「额度与计费」入口。
4. 纯前端改动，不动后端 API / DB / RBAC 规则。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 充值页 | 新增 `pages/quota-topup.tsx`（`QuotaTopupPage`），路由 `/quota-topup`，导航「额度充值 / 调整」，图标 `CreditCard`，仅 `team_admin`/`system` 可见 |
| 观察页 | 重构 `pages/billing.tsx`（`BillingPage`），仅保留余额卡片 + 额度流水，标题改为「余额与流水」，路由 `/billing` 不变 |
| 表单承载 | 充值/调整为**低频写操作**，页面无列表主体，表单直接以内联 Card 承载（非弹窗），复用 `rechargeQuota`/`adjustQuota` mutation + `listTeams`/`listMembers` query |
| 缺省团队 | 非 system 角色缺省 `user.teamId`；system 角色缺省「用户团队 → 首个团队」，可下拉切换 |
| 状态同步 | 充值/调整成功后 `invalidateQueries(['billing'])`，使「观察」页余额/流水自动刷新 |
| 复用 | 复用 `features/billing/api.ts`（`rechargeQuota`/`adjustQuota`）、`features/teams/api.ts`（`listTeams`/`listMembers`）、`features/auth/store.ts`，无新增依赖 |

## 4. RBAC 设计

| 资源 | 读 | 写 |
|---|---|---|
| 余额 + 流水（`/billing`） | `member`（仅本人）/`team_admin`/`system` | — |
| 充值 / 调整（`/quota-topup`） | `team_admin`/`system`（菜单可见） | `team_admin`/`system`（后端 `RolesGuard` 已控制） |

## 5. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [BILLING_QUOTA_REQ-009](../requirement/BILLING_QUOTA_REQ-009_FRONTEND_NAV_SPLIT.md) | 前端：新增充值/调整页（系统设置）、重构余额/流水页（观察）、改路由与导航 | `typecheck`/`lint`/`build` 通过；「系统设置」可见「额度充值 / 调整」，「观察」可见「余额与流水」，「LLM管理」无「额度与计费」；充值/调整成功后余额/流水刷新 |

## 6. 里程碑

1. ✅ REQ-009 前端导航拆分 + 页面重构（本文档拆解）。

## 7. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| C-01 | 菜单文案 | 定稿：系统设置「额度充值 / 调整」、观察「余额与流水」 |
| C-02 | 充值页表单承载 | 定稿：内联 Card（页面无列表主体，无需弹窗打断） |
| C-03 | 影响范围 | 纯前端，不动后端 API/DB/RBAC，无数据迁移 |

## 8. 关联

- 上游：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-10）、`docs/feature/billing_quota.md`
- feature：`docs/feature/billing_quota.md`
- requirement：见 §5
