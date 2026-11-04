# 团队与成员（team_member）

## 1. 功能设计

### 目标
- 团队（Team）实体：租户（Tenant）之下可建多个团队，单团队版 = 默认团队。
- 成员邀请/加入/移除，成员角色分配（team_admin/member/finance/viewer）。
- 落实 ADR-06「团队 → 成员(角色) → 多 key」层级中的团队层。

### 数据结构
- `Team` / `Invitation`：`docs/technical/db_schema/TEAM_MEMBER_SCHEMA.MD`。
- `User`（增量 `teamId`）：`docs/technical/db_schema/TENANT_USER_SCHEMA.MD`。

### 核心逻辑
- 默认团队自举：注册首个管理员时创建默认团队并回填 `user.teamId`。
- 成员加入：管理员直接添加成员（邮箱/用户名/角色，提交后自动加入团队）；邀请链接流程（`Invitation` + `accept-invite`）已停用前端入口，后端保留为死代码。
- RBAC：团队/成员写操作仅 `team_admin`；JWT payload 与 `AuthUser` 扩展 `teamId`。

## 2. 需求追溯

| Plan | Requirement | Development | Fix |
|------|------------|-------------|-----|
| [TEAM_MEMBER](../plan/TEAM_MEMBER_PLAN.md) | [REQ-001 后端团队与成员](../requirement/TEAM_MEMBER_REQ-001_BACKEND_TEAM.md) | [开发记录](../development/TEAM_MEMBER_REQ-001_DEVELOPMENT.md) | — |
| 同上 | [REQ-002 前端团队与成员管理](../requirement/TEAM_MEMBER_REQ-002_FRONTEND_TEAM.md) | [开发记录](../development/TEAM_MEMBER_REQ-002_DEVELOPMENT.md) | — |
| [TEAM_MEMBER_DIRECT_ADD](../plan/TEAM_MEMBER_DIRECT_ADD_PLAN.md) | [REQ-003 前端成员直接添加](../requirement/TEAM_MEMBER_REQ-003_FRONTEND_DIRECT_ADD.md) | [开发记录](../development/TEAM_MEMBER_REQ-003_DEVELOPMENT.md) | — |
| [TEAM_MANAGEMENT_OPTIMIZATION](../plan/TEAM_MANAGEMENT_OPTIMIZATION_PLAN.md) | [REQ-001 角色体系重构](../requirement/TEAM_MANAGEMENT_REQ-001_ROLE_SYSTEM.md)、[REQ-003 系统管理员+菜单](../requirement/TEAM_MANAGEMENT_REQ-003_SYSTEM_ADMIN_MENU.md) | [REQ-001](../development/TEAM_MANAGEMENT_REQ-001_DEVELOPMENT.md)、[REQ-003](../development/TEAM_MANAGEMENT_REQ-003_DEVELOPMENT.md) | — |
| [BILLING_QUOTA_POLICY](../plan/BILLING_QUOTA_POLICY_PLAN.md) | [REQ-006 策略数据模型](../requirement/BILLING_QUOTA_REQ-006_POLICY_MODEL.md)、[REQ-008 策略管理 UI](../requirement/BILLING_QUOTA_REQ-008_POLICY_UI.md) | [REQ-006](../development/BILLING_QUOTA_REQ-006_DEVELOPMENT.md)、[REQ-008](../development/BILLING_QUOTA_REQ-008_DEVELOPMENT.md) | — |
| [SYSTEM_ADMIN_ACCOUNT_MENU](../plan/SYSTEM_ADMIN_ACCOUNT_MENU_PLAN.md) | [REQ-003 账号与菜单优化（成员列表排除系统管理员）](../requirement/SYSTEM_ADMIN_REQ-003_ACCOUNT_MENU.md) | [开发记录](../development/SYSTEM_ADMIN_REQ-003_DEVELOPMENT.md) | — |

## 3. 相关文档
- 技术文档：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-03/06、§5.2、§7.1）、`docs/technical/db_schema/TEAM_MEMBER_SCHEMA.MD`
- 规划文档：`docs/plan/TEAM_MEMBER_PLAN.md`
- 上游：`docs/plan/TENANT_AUTH_PLAN.md`

## 4. 相关代码文件
- 后端：`apps/portal-backend/src/modules/teams/`、`users/schemas/user.schema.ts`、`auth/`
- 前端：`apps/portal-frontend/src/features/teams/`
