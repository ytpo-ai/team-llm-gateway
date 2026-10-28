# TEAM_MEMBER_REQ-001 开发记录（后端团队与成员）

> 对应需求：`docs/requirement/TEAM_MEMBER_REQ-001_BACKEND_TEAM.md`
> 对应计划：`docs/plan/TEAM_MEMBER_PLAN.md`
> 分支：`feat/team-member-backend`（提交 `35d0c49`）

## 1. 实现摘要

在租户（Tenant）之下落地独立 `Team` 实体与成员邀请制，复用 `tenant_auth` 已交付的鉴权与租户隔离约定：

- 数据模型：新增 `Team`（tenantId + name + status，唯一索引 `{tenantId,name}`）、`Invitation`（teamId + email + role + tokenHash + expiresAt + status + invitedBy）；`User` 增量新增 `teamId`。
- `teams` 模块：团队 CRUD、成员列表/角色更新/移除（软禁用）、邀请创建/列表/撤销。
- 邀请闭环：`POST /auth/accept-invite`（token sha256 校验 + 建用户 + 邀请置 accepted + 签发登录态）。
- 默认团队自举：注册时 `ensureDefaultTeam` 并回填 `user.teamId`。
- JWT payload 与 `AuthUser` 扩展 `teamId`；成员/团队接口返回脱敏视图（不泄露 `passwordHash`）。
- RBAC：团队/成员写操作 `@Roles(TEAM_ADMIN)`；模块间用 `forwardRef` 解耦 Auth ↔ Teams 循环依赖。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `modules/teams/schemas/team.schema.ts` | `Team` 实体 + `TeamStatus` |
| `modules/teams/schemas/invitation.schema.ts` | `Invitation` 实体 + `InvitationStatus` |
| `modules/teams/dto/*.ts` | `CreateTeamDto` / `UpdateTeamDto` / `CreateInvitationDto` / `UpdateMemberDto` |
| `modules/auth/dto/accept-invite.dto.ts` | 接受邀请入参（token/name/password） |
| `modules/teams/teams.service.ts` | 团队/成员/邀请业务逻辑 + token 生成（sha256） |
| `modules/teams/teams.controller.ts` | `/teams` 及子资源 REST 接口 |
| `modules/teams/teams.module.ts` | 模块装配（`forwardRef(AuthModule)` + UsersModule + Mongoose） |
| `modules/teams/teams.service.spec.ts` | 单测（9 例） |

### 修改

| 文件 | 说明 |
|---|---|
| `modules/users/schemas/user.schema.ts` | 新增 `teamId`（ref Team，可选，索引） |
| `modules/users/users.service.ts` | 新增 `listByTeam` / `updateById`，`CreateUserInput` 增加 `teamId` |
| `modules/auth/auth.service.ts` | register/login/refresh 注入 `teamId`；新增 `acceptInvite`；`JwtPayload` 扩展 `teamId` |
| `modules/auth/auth.controller.ts` | 新增 `POST /auth/accept-invite` |
| `modules/auth/strategies/jwt.strategy.ts` | `validate` 返回 `teamId` |
| `modules/auth/decorators/current-user.decorator.ts` | `AuthUser` 扩展 `teamId` |
| `modules/auth/auth.module.ts` | 引入 `forwardRef(TeamsModule)`，导出 `JwtAuthGuard`/`RolesGuard` |
| `app.module.ts` | 注册 `TeamsModule` |
| `modules/auth/auth.service.spec.ts` | 适配 teamId + 新增 acceptInvite 用例 |

## 3. 踩坑记录

1. **循环依赖**：AuthModule（accept-invite/bootstrap 需要 TeamsService）与 TeamsModule（controller 需要 JwtAuthGuard/RolesGuard）互相依赖。用 `forwardRef` 双向引用解决，且 provider 层无循环（TeamsService 不注入 AuthService）。
2. **`createdAt` 类型缺失**：`@Schema({ timestamps: true })` 运行时注入 `createdAt`，但 TS 类未声明导致类型错误。在 `Invitation` 类声明 `createdAt?/updatedAt?` 纯类型字段解决。
3. **成员接口泄露 `passwordHash`**：`listByTeam` 返回原始文档直接把哈希暴露给前端。已通过 `toMemberView` / `toTeamView` 脱敏（返回 `id` 而非 `_id`，剔除密码哈希）。此类「原始 Mongoose 文档直接作为响应」需在后续接口开发中重点排查。

## 4. 验证结果

- `pnpm --filter portal-backend lint`：0 errors / 0 warnings。
- `pnpm --filter portal-backend typecheck`：通过。
- `pnpm --filter portal-backend test`：19 passed（auth 9 + teams 9 + app 1）。
- 运行时冒烟（本地 `limountain` Mongo，端口 27017，`--noproxy '*'`）：
  - `register` → 201，返回 `user.teamId`，JWT payload 含 `teamId`，默认团队自动创建（`name=测试团队`）。
  - `GET /teams` → 返回脱敏团队视图。
  - `POST /teams/:id/invitations` → 返回 `{ invitation, token }`（token 仅返回一次）。
  - `POST /auth/accept-invite` → 创建 `member` 角色用户，`teamId` 正确，邀请置 `accepted`。
  - `GET /teams/:id/members` → 返回 admin + member，**不含 passwordHash**。
  - RBAC：member 令牌 `POST .../invitations` → 403；`GET .../members` → 200。

## 5. 关联

- feature：`docs/feature/team_member.md`
- 数据模型：`docs/technical/db_schema/TEAM_MEMBER_SCHEMA.MD`
- 待决事项：T-01（多团队多角色）、T-02（邀请邮件通知）、T-03（成员移除后的 key/用量归属）见 `docs/plan/TEAM_MEMBER_PLAN.md` §6。
