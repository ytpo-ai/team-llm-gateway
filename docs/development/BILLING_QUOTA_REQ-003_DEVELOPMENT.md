# BILLING_QUOTA_REQ-003 开发记录（前端额度看板）

> 对应需求：`docs/requirement/BILLING_QUOTA_REQ-003_FRONTEND_BILLING.md`
> 对应计划：`docs/plan/BILLING_QUOTA_PLAN.md`
> 分支：`main`

## 1. 实现摘要

落地前端额度看板：团队/成员额度余额 + 额度流水列表 + 充值/调整表单，路由 `/billing` + 导航接入。

- `features/billing/`（`types` + `api`）：账户/流水类型与 `GET/POST` API 封装。
- `pages/billing.tsx`：余额卡片（团队 + 成员）、流水表格（类型/来源/金额/余额/备注/时间）、充值/调整表单（`team_admin`/`finance` 可见，目标账户可选团队/成员）。
- 路由 `/billing` + `app-layout` 导航「额度」接入。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `features/billing/types.ts` | 账户/流水/充值/调整类型 |
| `features/billing/api.ts` | 余额/流水查询 + 充值/调整 API |
| `pages/billing.tsx` | 额度看板页 |

### 修改

| 文件 | 说明 |
|---|---|
| `router.tsx` | 新增 `/billing` 路由 |
| `components/layout/app-layout.tsx` | 导航接入「额度」 |

## 3. 踩坑记录

1. **无 select 组件**：shadcn/ui 目前仅 `button/card/input`，表单用原生 `<select>` 实现「充值/调整」与「目标账户」选择，样式用 Tailwind 手动对齐 `Input`。
2. **角色控制表单显隐**：`useAuthStore` 读取 `user.role`，仅 `team_admin`/`finance` 展示充值/调整表单，`member` 仅见本人余额与流水。

## 4. 验证结果

- `pnpm --filter portal-frontend typecheck`：通过。
- `pnpm --filter portal-frontend lint`：0 errors（1 条既有 warning，非本模块）。
- `pnpm --filter portal-frontend build`：通过。

## 5. 关联

- feature：`docs/feature/billing_quota.md`
- 上游：`docs/plan/BILLING_QUOTA_PLAN.md` §3
