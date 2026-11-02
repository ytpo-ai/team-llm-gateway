# 计费与额度（billing_quota）

## 1. 功能设计

### 目标
- 统一扣费引擎（唯一）：模型倍率 × token，含缓存计费、阶梯价。
- 可插拔额度来源：首期充值额度 / 月结账单 / 赠送额度（兑换码、订阅后置）。
- 额度账户：团队级 / 成员级；服务商角色可看全局额度池。
- 落实 ADR-10「统一扣费引擎 + 可插拔额度来源」。

### 数据结构
- `QuotaAccount`（额度账户：team/member）+ `QuotaTransaction`（额度流水）：`docs/technical/db_schema/BILLING_QUOTA_SCHEMA.MD`。

### 核心逻辑
- 统一扣费引擎（唯一）：`cost = multiplier × totalTokens`，`deduct()` 成员账户优先、团队账户兜底，原子扣减防负余额。
- 可插拔额度来源（首发 `recharge`/`manual`）：`source` 标识渠道，`monthly`/`gift` 后置为插件（D-03）。
- 转发层限额联动：`rateLimitPerMinute`（内存滑动窗口）+ `maxTokens`（累计 token 预算）+ 余额预检 → 转发后扣减（闭环 USAGE_METERING U-01）。

## 2. 需求追溯

| Plan | Requirement | Development | Fix |
|------|------------|-------------|-----|
| [BILLING_QUOTA](../plan/BILLING_QUOTA_PLAN.md) | [REQ-001 后端计费](../requirement/BILLING_QUOTA_REQ-001_BACKEND_BILLING.md) | [开发记录](../development/BILLING_QUOTA_REQ-001_DEVELOPMENT.md) | — |
| 同上 | [REQ-002 转发层联动](../requirement/BILLING_QUOTA_REQ-002_BACKEND_PROXY_ENFORCEMENT.md) | [开发记录](../development/BILLING_QUOTA_REQ-002_DEVELOPMENT.md) | — |
| 同上 | [REQ-003 前端额度看板](../requirement/BILLING_QUOTA_REQ-003_FRONTEND_BILLING.md) | [开发记录](../development/BILLING_QUOTA_REQ-003_DEVELOPMENT.md) | — |
| [TEAM_MANAGEMENT_OPTIMIZATION](../plan/TEAM_MANAGEMENT_OPTIMIZATION_PLAN.md) | [REQ-002 三级限额模型](../requirement/TEAM_MANAGEMENT_REQ-002_QUOTA_LIMIT.md) | — | — |

## 3. 相关文档
- 技术文档：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-10、§7.2、D-03）、`docs/technical/db_schema/BILLING_QUOTA_SCHEMA.MD`
- 规划文档：`docs/plan/BILLING_QUOTA_PLAN.md`

## 4. 相关代码文件
- 后端：`apps/portal-backend/src/modules/billing/`、`apps/portal-backend/src/modules/proxy/`（限额联动）
- 前端：`apps/portal-frontend/src/features/billing/`、`pages/billing.tsx`
