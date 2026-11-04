# BILLING_QUOTA_REQ-009 开发记录（前端导航拆分：充值→系统设置 / 余额流水→观察）

> 对应需求：`docs/requirement/BILLING_QUOTA_REQ-009_FRONTEND_NAV_SPLIT.md`
> 对应计划：`docs/plan/BILLING_QUOTA_MENU_SPLIT_PLAN.md`
> 分支：`feat/billing-menu-split`

## 1. 实现摘要

将「额度与计费」页面拆分为两个职责独立的页面：充值/调整额度归入「系统设置」菜单，余额 + 流水展示归入「观察」菜单，从「LLM管理」移除「额度与计费」入口。

- `pages/quota-topup.tsx`（新增）：充值 / 调整额度页，表单以内联 Card 承载（页面无列表主体），复用 `rechargeQuota`/`adjustQuota` + `listTeams`/`listMembers`，缺省团队 `user.teamId` → 首个团队，system 可下拉切换；成功后 `invalidateQueries(['billing'])`。
- `pages/billing.tsx`（重构）：仅保留余额卡片 + `TransactionTable` 流水，移除充值按钮/弹窗、`useMutation`/`useQueryClient`/表单相关 state，标题改为「余额与流水」。
- `router.tsx`：新增 `/quota-topup` 路由（`QuotaTopupPage`）。
- `app-layout.tsx`：「LLM管理」移除「额度与计费」；「系统设置」新增「额度充值 / 调整」（`team_admin`/`system`，图标 `CreditCard`）；「观察」新增「余额与流水」（全员，图标 `Wallet`）。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `pages/quota-topup.tsx` | 充值 / 调整额度页（系统操作） |

### 修改

| 文件 | 说明 |
|---|---|
| `pages/billing.tsx` | 移除充值/调整（按钮+弹窗+表单 state+mutation），仅保留余额卡片 + 流水 |
| `router.tsx` | 新增 `/quota-topup` 路由 |
| `components/layout/app-layout.tsx` | 导航拆分：LLM管理移除计费，系统设置加充值，观察加余额流水 |
| `docs/feature/billing_quota.md` | 追溯表 + 相关代码文件更新 |

## 3. 踩坑记录

1. **充值页缺省团队与异步加载**：`listTeams` 异步返回，无法在打开时同步注入默认团队。改为渲染期派生 `teamId = form.teamId || defaultTeamId`（`defaultTeamId = 用户团队 → 首个团队 → user.teamId → ''`），`membersQuery` 与提交 payload 统一用派生的 `teamId`，避免 `useEffect` 内 setState（触发 `react/set-state-in-effect` 告警）。
2. **观察页类型收窄**：移除充值逻辑后 `billing.tsx` 不再需要 `useMutation`/`useQueryClient`/`Button`/`Select`/`Input`/`Dialog` 等，逐一清理 import 与本地 state，保证 `tsc -b` 无 unused 报错。

## 4. 验证结果

- `pnpm --filter portal-frontend typecheck`：通过。
- `pnpm --filter portal-frontend lint`：通过（仅 2 条既有 warning，非本模块）。
- `pnpm --filter portal-frontend build`：通过（chunk >500kB 为既有提示，非本模块引入）。

## 5. 关联

- feature：`docs/feature/billing_quota.md`
- 上游：`docs/plan/BILLING_QUOTA_MENU_SPLIT_PLAN.md` §3
