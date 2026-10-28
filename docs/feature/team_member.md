# 团队与成员（team_member）

## 1. 功能设计

### 目标
- 团队 CRUD（名称、租户归属）。
- 成员邀请/加入/移除，成员角色分配。
- 成员级额度账户（与计费额度模块联动）。
- 落实 ADR-06「团队 → 成员(角色) → 多 key」层级。

### 数据结构
- 待设计。

### 核心逻辑
- 待设计。

## 2. 需求追溯

| Plan | Requirement | Development | Fix |
|------|------------|-------------|-----|
| [PORTAL_FOUNDATION](../plan/PORTAL_FOUNDATION_PLAN.md) | — | — | — |

## 3. 相关文档
- 技术文档：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-06、§5.2、§7.1）

## 4. 相关代码文件
- 后端：`apps/portal-backend/src/modules/team/`、`member/`
- 前端：`apps/portal-frontend/src/features/team/`
