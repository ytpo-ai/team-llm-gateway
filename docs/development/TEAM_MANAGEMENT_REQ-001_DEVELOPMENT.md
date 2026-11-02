# TEAM_MANAGEMENT_REQ-001 开发记录（角色体系重构）

> 对应需求：`docs/requirement/TEAM_MANAGEMENT_REQ-001_ROLE_SYSTEM.md`
> 对应计划：`docs/plan/TEAM_MANAGEMENT_OPTIMIZATION_PLAN.md`
> 分支：`main`（提交 `1c4e008`）

## 1. 实现摘要

落地两层角色体系（角色A 管理范围 + 角色B LLM 使用限制），并放宽成员登录约束：

- 角色A 收敛为固定 3 值 `system` / `team_admin` / `member`，彻底废弃 `finance`/`viewer`/`provider`。
- 新增角色B 实体 `RoleTemplate`（内置模板 seed + 团队自定义），`User.roleTemplateId` 引用。
- `User.email`/`passwordHash` 改为可选，`{tenantId,email}` 唯一索引改 partial（仅非空邮箱唯一）。
- 登录判定放宽为「有密码才能登录」；成员可不设密码/邮箱，仅作员工标记。
- teams 模块新增直接添加成员端点（无需登录/邮箱，密码可选）。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `modules/role-templates/schemas/role-template.schema.ts` | `RoleTemplate` 实体（name/描述/日周月限额/速率/providerIds/modelWhitelist/builtIn） |
| `modules/role-templates/dto/*.ts` | `CreateRoleTemplateDto` / `UpdateRoleTemplateDto` |
| `modules/role-templates/role-templates.service.ts` | 内置模板 seed + 团队模板 CRUD（内置不可删） |
| `modules/role-templates/role-templates.controller.ts` | `/role-templates` REST + 审计埋点 |
| `modules/role-templates/role-template-seed.service.ts` | `OnApplicationBootstrap` 引导内置模板 |
| `modules/role-templates/role-templates.module.ts` | 模块装配 |
| `modules/role-templates/role-templates.service.spec.ts` | 单测（8 例） |
| `modules/teams/dto/create-member.dto.ts` | 直接添加成员入参（name 必填，email/password/role/roleTemplateId 可选） |
| `frontend/src/features/role-templates/{api,types}.ts` | 前端角色模板 API 封装与类型 |
| `frontend/src/pages/roles.tsx` | 角色管理页 |

### 修改

| 文件 | 说明 |
|---|---|
| `common/enums/role.enum.ts` | Role 枚举收敛为 3 值 |
| `modules/users/schemas/user.schema.ts` | `email`/`passwordHash` 可选 + `roleTemplateId` + partial 唯一索引 |
| `modules/users/users.service.ts` | `CreateUserInput`/`UpdateUserInput` 调整 |
| `modules/auth/auth.service.ts` | `loginUser` 增加无密码登录拦截；`email ?? ''` |
| `modules/billing/billing.controller.ts` | `@Roles` 去 FINANCE，改 `TEAM_ADMIN, SYSTEM` |
| `modules/billing/billing.service.ts` | `buildLabelMap` 兼容空邮箱 |
| `modules/system/schemas/audit-log.schema.ts` | `AuditResourceType` 新增 `role_template` |
| `modules/teams/teams.service.ts` | `createMember` + `updateMember` 支持 `roleTemplateId` |
| `modules/teams/teams.controller.ts` | 新增 `POST /teams/:teamId/members` |
| `app.module.ts` | 注册 `RoleTemplatesModule` |
| `frontend/src/features/auth/types.ts` | `Role` 收敛、`User.email` 可空 |
| `frontend/src/features/teams/{api,types}.ts` | `Member` 加 `roleTemplateId`、`ROLE_LABELS`/`ASSIGNABLE_ROLES` 收敛 |
| `frontend/src/pages/team.tsx` | 成员列表支持绑定/解绑角色B |
| `frontend/src/pages/billing.tsx` | `canManage` 去 finance |
| `frontend/src/router.tsx`、`app-layout.tsx` | 新增「角色」页与菜单 |

## 3. 踩坑记录

1. **union 类型字段需显式 `type`**：`email?: string | null` 使 `@Prop` 无法推断类型，运行时抛「Cannot determine a type」。需显式 `@Prop({ type: String, ... })`。
2. **partial 唯一索引**：email 可空后，`{tenantId,email}` 唯一索引会对多个 null 冲突，用 `partialFilterExpression: { email: { $type: 'string' } }` 仅对非空邮箱唯一。
3. **`JwtPayload.email` 类型漂移**：email 可空后 `issueTokens` 需 `user.email ?? ''`，`billing.buildLabelMap` 需 `name || email || ''`。

## 4. 验证结果

- `pnpm --filter portal-backend lint`：0 errors / 0 warnings。
- `pnpm --filter portal-backend typecheck`：通过。
- `pnpm --filter portal-backend test`：87 passed。
- `pnpm --filter portal-frontend typecheck` / `build`：通过。

## 5. 关联

- feature：`docs/feature/team_member.md`、`tenant_auth.md`
- 数据模型：`docs/technical/db_schema/ROLE_TEMPLATE_SCHEMA.MD`、`TENANT_USER_SCHEMA.MD`
- 待决事项：T-01（单成员限额 override 预留）、T-02（角色B 字段细化）见 plan §6。
