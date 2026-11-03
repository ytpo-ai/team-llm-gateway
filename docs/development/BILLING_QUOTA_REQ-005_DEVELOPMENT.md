# BILLING_QUOTA_REQ-005 开发记录（前端货币汇率设置 + 计费展示）

> 对应需求：`docs/requirement/BILLING_QUOTA_REQ-005_FRONTEND_CURRENCY.md`
> 对应计划：`docs/plan/BILLING_QUOTA_CURRENCY_RATE_PLAN.md`
> 分支：`main`

## 1. 实现摘要

落地前端货币汇率配置与计费双显：系统设置页新增「货币汇率」卡片（增删币种/设展示货币/填点数），计费页余额/流水在「点数」旁并列展示「货币金额」，未配置汇率时回退纯点数。

- `features/system/`：`types.ts` 新增 `CurrencyConfig`/`CurrencyRate`，`api.ts` 新增 `getCurrency`/`updateCurrency`；`AuditAction`/`AuditResourceType` 补 `currency_update`/`currency`。
- `features/system/components/currency-settings-card.tsx`：货币汇率编辑卡片（react-query + 子组件按 config 重新挂载初始化，避免 effect 内 setState）。
- `pages/billing.tsx`：余额卡片 + 流水表双显（`Intl.NumberFormat(style: 'currency')` 格式化，非法币种 code 时降级为「数值 + code」）。
- `pages/audit-logs.tsx`：动作/资源标签补 `currency_update`/`currency`。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `features/system/components/currency-settings-card.tsx` | 货币汇率编辑卡片 |

### 修改

| 文件 | 说明 |
|---|---|
| `features/system/types.ts` | 新增 `CurrencyConfig`/`CurrencyRate`；审计枚举补 `currency` 值 |
| `features/system/api.ts` | 新增 `getCurrency`/`updateCurrency` |
| `pages/settings.tsx` | 接入货币汇率卡片；`billing.currency` 从「其他配置」排除 |
| `pages/billing.tsx` | 余额/流水双显（点数 + 货币） |
| `pages/audit-logs.tsx` | 审计动作/资源标签补 `currency` 相关项 |

## 3. 踩坑记录

1. **setState-in-effect 告警**：初始版本用 `useEffect` 把 `getCurrency` 结果同步进本地编辑 state，触发 `react(set-state-in-effect)` 告警。改为子组件 `CurrencyEditorForm` 以 `config` 作 `useState` 初始值 + 父级按 `key=JSON.stringify(config)` 重新挂载，消除告警。
2. **非法币种 code**：`Intl.NumberFormat` 遇非法 ISO 4217 code 会抛 `RangeError`，用 try/catch 降级为「数值 + code」避免展示崩溃。

## 4. 验证结果

- `pnpm --filter portal-frontend typecheck`：通过。
- `pnpm --filter portal-frontend lint`：0 errors（4 条既有 warning，非本模块）。
- `pnpm --filter portal-frontend build`：通过。

## 5. 关联

- feature：`docs/feature/billing_quota.md`、`docs/feature/system_admin.md`
- 上游：`docs/plan/BILLING_QUOTA_CURRENCY_RATE_PLAN.md` §3
