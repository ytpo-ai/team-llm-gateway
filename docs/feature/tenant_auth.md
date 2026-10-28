# 租户与认证（tenant_auth）

## 1. 功能设计

### 目标
- 租户注册/配置，支撑多租户（ADR-03）；单团队开源版 tenantId 固定为 1。
- 用户认证：本地账号（邮箱/密码）+ JWT(access+refresh)，预留 OIDC/OAuth 接口。
- 登录会话管理、2FA（可选）。
- RBAC 角色权限（团队管理员/成员/财务/只读 + 服务商/系统角色）。

### 数据结构
- 待设计（`docs/technical/db_schema/` 后续落盘）。

### 核心逻辑
- 待设计。

## 2. 需求追溯

| Plan | Requirement | Development | Fix |
|------|------------|-------------|-----|
| [PORTAL_FOUNDATION](../plan/PORTAL_FOUNDATION_PLAN.md) | — | — | — |

## 3. 相关文档
- 技术文档：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-03/04、§6）
- 规划文档：`docs/plan/PORTAL_FOUNDATION_PLAN.md`

## 4. 相关代码文件
- 后端：`apps/portal-backend/src/modules/auth/`、`tenant/`
- 前端：`apps/portal-frontend/src/pages/Login`、`src/features/auth/`
