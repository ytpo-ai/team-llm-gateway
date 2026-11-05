# 租户与认证（tenant_auth）

## 1. 功能设计

### 目标
- 租户注册/配置，支撑多租户（ADR-03）；单团队开源版 tenantId 固定为 1。
- 用户认证：本地账号（邮箱/密码）+ JWT(access+refresh)，预留 OIDC/OAuth 接口。
- 登录会话管理、2FA（可选）。
- RBAC 角色权限（团队管理员/成员/财务/只读 + 服务商/系统角色）。

### 数据结构
- `Tenant` / `User`：`docs/technical/db_schema/TENANT_USER_SCHEMA.MD`。

### 核心逻辑
- 本地账号认证：邮箱+密码（bcrypt）+ JWT(access+refresh)，payload 含 `sub/email/tenantId/role`。
- 租户初始化：首次注册自举默认租户 + 首个系统管理员；系统初始化门控（已初始化后 `register` 拒绝，前端隐藏初始化 UI）。
- RBAC：`team_admin/member/finance/viewer`（+ 预留 `provider/system`）。

## 2. 需求追溯

| Plan | Requirement | Development | Fix |
|------|------------|-------------|-----|
| [PORTAL_FOUNDATION](../plan/PORTAL_FOUNDATION_PLAN.md) | — | — | — |
| [TENANT_AUTH](../plan/TENANT_AUTH_PLAN.md) | [REQ-001 后端租户与认证](../requirement/TENANT_AUTH_REQ-001_BACKEND_AUTH.md) | [开发记录](../development/TENANT_AUTH_REQ-001_DEVELOPMENT.md) | — |
| 同上 | [REQ-002 前端认证闭环](../requirement/TENANT_AUTH_REQ-002_FRONTEND_AUTH.md) | [开发记录](../development/TENANT_AUTH_REQ-002_DEVELOPMENT.md) | — |
| [TEAM_MANAGEMENT_OPTIMIZATION](../plan/TEAM_MANAGEMENT_OPTIMIZATION_PLAN.md) | [REQ-001 角色体系重构](../requirement/TEAM_MANAGEMENT_REQ-001_ROLE_SYSTEM.md) | [开发记录](../development/TEAM_MANAGEMENT_REQ-001_DEVELOPMENT.md) | — |
| [SYSTEM_ADMIN_ACCOUNT_MENU](../plan/SYSTEM_ADMIN_ACCOUNT_MENU_PLAN.md) | [REQ-003 账号与菜单优化（修改密码）](../requirement/SYSTEM_ADMIN_REQ-003_ACCOUNT_MENU.md) | [开发记录](../development/SYSTEM_ADMIN_REQ-003_DEVELOPMENT.md) | — |
| [TENANT_AUTH_INITIALIZATION_GATE](../plan/TENANT_AUTH_INITIALIZATION_GATE_PLAN.md) | [REQ-003 初始化门控](../requirement/TENANT_AUTH_REQ-003_INITIALIZATION_GATE.md) | [开发记录](../development/TENANT_AUTH_REQ-003_DEVELOPMENT.md) | — |

## 3. 相关文档
- 技术文档：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-03/04、§6）、`docs/technical/db_schema/TENANT_USER_SCHEMA.MD`
- 规划文档：`docs/plan/PORTAL_FOUNDATION_PLAN.md`、`docs/plan/TENANT_AUTH_PLAN.md`

## 4. 相关代码文件
- 后端：`apps/portal-backend/src/modules/auth/`、`tenant/`
- 前端：`apps/portal-frontend/src/pages/Login`、`src/features/auth/`
