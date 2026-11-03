# BILLING_QUOTA_REQ-005 前端货币汇率设置 + 计费展示

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/billing_quota.md`、`docs/feature/system_admin.md` |
| 所属 plan | `docs/plan/BILLING_QUOTA_CURRENCY_RATE_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/billing-currency-rate-frontend` |
| 状态 | `done` |

## 2. 需求描述

### 背景
后端已提供 `GET/PUT /system/currency`（REQ-004）。本期落地前端：系统设置页新增「货币汇率」配置，计费页余额/流水按货币展示，让额度与成本可读为金额。

### 目标
- 设置页（`pages/settings.tsx`）新增「货币汇率」卡片：
  - 可增删货币行（`code`/`name`/`pointsPerUnit`），设定默认展示货币（`displayCurrency`）。
  - 提交时调用 `PUT /system/currency`（`team_admin` 可见）。
- 计费页（`pages/billing.tsx`）：
  - 拉取 `GET /system/currency`。
  - 余额、流水金额在「点数」旁并列展示「展示货币金额」，用 `Intl.NumberFormat(locale, { style: 'currency', currency: code })` 格式化。
  - 未配置汇率时回退纯点数展示（不报错）。
- 新增 `features/system` 的 currency 类型与 api（`getCurrency`/`updateCurrency`）。

### 验收条件
- [ ] `pnpm --filter portal-frontend dev` / `build` 通过。
- [ ] 设置页可增删货币、设默认展示货币、保存后生效（`GET /system/currency` 返回新配置）。
- [ ] 计费页余额/流水正确按展示货币格式化，并保留点数展示。
- [ ] 未配置汇率时计费页正常回退点数展示。
- [ ] `pnpm --filter portal-frontend lint` 通过。

## 3. 技术方案摘要
- 复用 `@tanstack/react-query`、`features/system/api.ts`、shadcn 组件（`Card`/`Input`/`Button`/`Select`）。
- `features/system/types.ts` 新增 `CurrencyConfig`/`CurrencyRate` 类型；`api.ts` 新增 `getCurrency`/`updateCurrency`。
- 计费页复用 `Intl.NumberFormat` 按币种格式化，换算逻辑 = `points / pointsPerUnit`。
- 结构详见 `docs/plan/BILLING_QUOTA_CURRENCY_RATE_PLAN.md` §3。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/BILLING_QUOTA_REQ-005_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
