# TEAM_MEMBER_REQ-001 后端团队与成员

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/team_member.md` |
| 所属 plan | `docs/plan/TEAM_MEMBER_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/team-member-backend` |
| 状态 | `done` |

## 2. 需求描述

### 背景
`tenant_auth` 已交付 Tenant/User/JWT/RBAC。现落地团队与成员模块后端：租户之下新增独立 `Team` 实体、成员邀请制、成员角色管理，复用现有鉴权与租户隔离约定。

### 目标
- 新增 `Team` / `Invitation` 数据模型，`User` 增量新增 `teamId`（详见 `docs/technical/db_schema/TEAM_MEMBER_SCHEMA.MD`）。
- 默认团队自举：注册首个管理员时创建默认团队并回填 `user.teamId`。
- `teams` 模块：团队 CRUD、成员列表/角色更新/移除、邀请创建/列表/撤销。
- 邀请接受：`POST /auth/accept-invite`（token 校验 + 建用户 + 置 accepted + 返回登录态）。
- RBAC：团队/成员写操作仅 `team_admin`；JWT payload 与 `AuthUser` 扩展 `teamId`。
- 租户隔离：所有查询按 `tenantId` 过滤。

### 验收条件
- [x] `pnpm --filter portal-backend start:dev` 启动成功。
- [x] Swagger 可调 `GET/POST /teams`、`PATCH /teams/:id`、`GET /teams/:id/members`、`PATCH/DELETE /teams/:id/members/:userId`、`POST/GET/DELETE /teams/:id/invitations`、`POST /auth/accept-invite`。
- [x] 注册后默认团队创建、`user.teamId` 回填；登录返回 JWT 含 `teamId`。
- [x] 邀请 → 接受 → 成员可见闭环落库正确。
- [x] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过。

## 3. 技术方案摘要
- 复用 Nest.js + Mongoose + class-validator + Swagger 既有模式（参考 `apps/portal-backend/src/modules/auth/`、`users/`、`tenant/`）。
- 数据模型与流程见 `docs/technical/db_schema/TEAM_MEMBER_SCHEMA.MD`、`docs/plan/TEAM_MEMBER_PLAN.md` §3。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/TEAM_MEMBER_REQ-001_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
