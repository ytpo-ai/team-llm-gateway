# 计费与额度（billing_quota）

## 1. 功能设计

### 目标
- 统一扣费引擎（唯一）：模型倍率 × token，含缓存计费、阶梯价。
- 可插拔额度来源：首期充值额度 / 月结账单 / 赠送额度（兑换码、订阅后置）。
- 额度账户：团队级 / 成员级；服务商角色可看全局额度池。
- 限制策略化：团队/角色/key 三级「范围限制 + 用量限制」统一挂载 `PolicySet`，转发层取最严求值（token/request/concurrency/spend × 窗口 × block/warn）。
- 落实 ADR-10「统一扣费引擎 + 可插拔额度来源」。

### 数据结构
- `QuotaAccount`（额度账户：team/member）+ `QuotaTransaction`（额度流水）：`docs/technical/db_schema/BILLING_QUOTA_SCHEMA.MD`。

### 核心逻辑
- 统一扣费引擎（唯一）：`cost = multiplier × totalTokens`，`deduct()` 成员账户优先、团队账户兜底，原子扣减防负余额。
- 可插拔额度来源（首发 `recharge`/`manual`）：`source` 标识渠道，`monthly`/`gift` 后置为插件（D-03）。
- 转发层限额联动：策略求值引擎（`QuotaLimitService`）按团队/角色/key 三级策略集逐级取最严校验（token/request/concurrency/spend × 窗口 × block/warn）+ 余额预检 → 转发后扣减（闭环 USAGE_METERING U-01）。

## 2. 需求追溯

| Plan | Requirement | Development | Fix |
|------|------------|-------------|-----|
| [BILLING_QUOTA](../plan/BILLING_QUOTA_PLAN.md) | [REQ-001 后端计费](../requirement/BILLING_QUOTA_REQ-001_BACKEND_BILLING.md) | [开发记录](../development/BILLING_QUOTA_REQ-001_DEVELOPMENT.md) | [fix 充值/调整弹窗选团队](../issue/fix/2026-11-04-billing-topup-team-selection.md) |
| 同上 | [REQ-002 转发层联动](../requirement/BILLING_QUOTA_REQ-002_BACKEND_PROXY_ENFORCEMENT.md) | [开发记录](../development/BILLING_QUOTA_REQ-002_DEVELOPMENT.md) | — |
| 同上 | [REQ-003 前端额度看板](../requirement/BILLING_QUOTA_REQ-003_FRONTEND_BILLING.md) | [开发记录](../development/BILLING_QUOTA_REQ-003_DEVELOPMENT.md) | [fix 充值/调整弹窗选团队](../issue/fix/2026-11-04-billing-topup-team-selection.md) |
| [TEAM_MANAGEMENT_OPTIMIZATION](../plan/TEAM_MANAGEMENT_OPTIMIZATION_PLAN.md) | [REQ-002 三级限额模型](../requirement/TEAM_MANAGEMENT_REQ-002_QUOTA_LIMIT.md) | [开发记录](../development/TEAM_MANAGEMENT_REQ-002_DEVELOPMENT.md) | — |
| [API_KEY_MEMBER_BINDING](../plan/API_KEY_MEMBER_BINDING_PLAN.md) | [REQ-003 后端成员绑定与聚合](../requirement/API_KEY_REQ-003_BACKEND_MEMBER_BINDING.md) | [开发记录](../development/API_KEY_REQ-003_DEVELOPMENT.md) | — |
| [BILLING_QUOTA_CURRENCY_RATE](../plan/BILLING_QUOTA_CURRENCY_RATE_PLAN.md) | [REQ-004 后端货币汇率](../requirement/BILLING_QUOTA_REQ-004_BACKEND_CURRENCY.md) | [开发记录](../development/BILLING_QUOTA_REQ-004_DEVELOPMENT.md) | — |
| 同上 | [REQ-005 前端货币设置与展示](../requirement/BILLING_QUOTA_REQ-005_FRONTEND_CURRENCY.md) | [开发记录](../development/BILLING_QUOTA_REQ-005_DEVELOPMENT.md) | — |
| [BILLING_QUOTA_POLICY](../plan/BILLING_QUOTA_POLICY_PLAN.md) | [REQ-006 策略数据模型](../requirement/BILLING_QUOTA_REQ-006_POLICY_MODEL.md)、[REQ-007 策略求值引擎](../requirement/BILLING_QUOTA_REQ-007_POLICY_ENGINE.md)、[REQ-008 策略管理 UI](../requirement/BILLING_QUOTA_REQ-008_POLICY_UI.md) | [REQ-006](../development/BILLING_QUOTA_REQ-006_DEVELOPMENT.md)、[REQ-007](../development/BILLING_QUOTA_REQ-007_DEVELOPMENT.md)、[REQ-008](../development/BILLING_QUOTA_REQ-008_DEVELOPMENT.md) | — |
| [BILLING_QUOTA_MENU_SPLIT](../plan/BILLING_QUOTA_MENU_SPLIT_PLAN.md) | [REQ-009 前端导航拆分](../requirement/BILLING_QUOTA_REQ-009_FRONTEND_NAV_SPLIT.md) | [开发记录](../development/BILLING_QUOTA_REQ-009_DEVELOPMENT.md) | — |
| [BILLING_QUOTA_MEMBER_VIEW](../plan/BILLING_QUOTA_MEMBER_VIEW_PLAN.md) | [REQ-010 余额/流水成员级视图](../requirement/BILLING_QUOTA_REQ-010_MEMBER_VIEW.md) | [开发记录](../development/BILLING_QUOTA_REQ-010_DEVELOPMENT.md) | — |
| [BILLING_QUOTA_VIEW_FILTER](../plan/BILLING_QUOTA_VIEW_FILTER_PLAN.md) | [REQ-011 观察页筛选 + 余额布局](../requirement/BILLING_QUOTA_REQ-011_FRONTEND_VIEW_FILTER.md) | [开发记录](../development/BILLING_QUOTA_REQ-011_DEVELOPMENT.md) | — |
| [BILLING_QUOTA_TX_FILTER_PAGINATION](../plan/BILLING_QUOTA_TX_FILTER_PAGINATION_PLAN.md) | [REQ-012 单下拉筛选 + 流水分页](../requirement/BILLING_QUOTA_REQ-012_FILTER_PAGINATION.md) | [开发记录](../development/BILLING_QUOTA_REQ-012_DEVELOPMENT.md) | — |

## 3. 相关文档
- 技术文档：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-10、§7.2、D-03）、`docs/technical/db_schema/BILLING_QUOTA_SCHEMA.MD`
- 规划文档：`docs/plan/BILLING_QUOTA_PLAN.md`

## 4. 相关代码文件
- 后端：`apps/portal-backend/src/modules/billing/`、`apps/portal-backend/src/modules/proxy/`（限额联动）
- 前端：`apps/portal-frontend/src/features/billing/`、`pages/billing.tsx`（余额/流水，观察）、`pages/quota-topup.tsx`（充值/调整，系统设置）
