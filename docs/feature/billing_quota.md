# 计费与额度（billing_quota）

## 1. 功能设计

### 目标
- 统一扣费引擎（唯一）：模型倍率 × token，含缓存计费、阶梯价。
- 可插拔额度来源：首期充值额度 / 月结账单 / 赠送额度（兑换码、订阅后置）。
- 额度账户：团队级 / 成员级；服务商角色可看全局额度池。
- 落实 ADR-10「统一扣费引擎 + 可插拔额度来源」。

### 数据结构
- 待设计（额度账户 / 扣费流水 / 账单）。

### 核心逻辑
- 待设计（额度来源插件接口 + 扣费引擎，D-03）。

## 2. 需求追溯

| Plan | Requirement | Development | Fix |
|------|------------|-------------|-----|
| [PORTAL_FOUNDATION](../plan/PORTAL_FOUNDATION_PLAN.md) | — | — | — |

## 3. 相关文档
- 技术文档：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-10、§7.2、D-03）

## 4. 相关代码文件
- 后端：`apps/portal-backend/src/modules/billing/`
- 前端：`apps/portal-frontend/src/features/billing/`
