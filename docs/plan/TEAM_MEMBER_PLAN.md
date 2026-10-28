# 团队与成员模块开发计划（TEAM_MEMBER）

> 本 plan 固化 Portal 业务模块 **团队与成员（team_member）** 的工程方案，落地 ADR-06「团队 → 成员(角色) → 多 key」层级中的团队层。
>
> - 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-03/04/06、§5.2、§7.1）
> - 上游 plan：`docs/plan/TENANT_AUTH_PLAN.md`（租户与认证已交付，复用其 Tenant/User/JWT/RBAC 上下文）
> - 定稿时间：2026-10-28
> - 状态：已批准

---

## 1. 需求背景

`tenant_auth` 已交付（Tenant + User + JWT + RBAC 基础，REQ-001/002 均 `done`）。现落地「团队与成员」模块：在租户（Tenant）之下新增**独立 Team 实体**，成员以**邀请制**加入，为下游 `api_key`/`usage_metering` 提供「成员属于哪个团队」的上下文。

## 2. 目标

1. 新增 `Team` 实体（多租户内建，单团队版 = 默认团队随租户自举）。
2. 成员邀请制：管理员生成邀请链接/口令 → 受邀者接受后注册成为成员。
3. 成员角色分配（team_admin / member / finance / viewer）。
4. RBAC：团队与成员的写操作仅 `team_admin` 可执行。
5. 前端团队/成员管理页 + 接受邀请页。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 数据模型 | 新增 `Team`、`Invitation` 两个集合；`User` 增量新增 `teamId`；详见 `docs/technical/db_schema/TEAM_MEMBER_SCHEMA.MD` |
| 团队隔离 | `Team` 携带 `tenantId`，查询按 `tenantId` 过滤（沿用 D-04 起点约定） |
| 角色归属 | 首期角色保留在 `User.role`（一个用户一个团队）；多团队多角色的 `TeamMember` 关联表留待后续 |
| 邀请 | 管理员创建邀请（email + role）→ `crypto` 随机 token，sha256 哈希落库，短时效（默认 7 天）→ 受邀者凭 token 注册（`POST /auth/accept-invite`）→ 建 User + 邀请置 `accepted` |
| 鉴权 | 复用 `JwtAuthGuard` / `RolesGuard` / `@Roles()` / `@CurrentUser()`；JWT payload 扩展 `teamId` |
| 默认团队自举 | 注册时 `ensureDefaultTeam(tenantId)` 并回填 `user.teamId` |

## 4. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [TEAM_MEMBER_REQ-001](../requirement/TEAM_MEMBER_REQ-001_BACKEND_TEAM.md) | 后端：Team/Invitation schema、User.teamId、默认团队自举、teams 模块 CRUD/邀请/成员、accept-invite、RBAC、租户隔离 | `start:dev` 启动，Swagger 可调 teams/members/invitations/accept-invite，Mongo 落库，lint/typecheck/test 通过 |
| [TEAM_MEMBER_REQ-002](../requirement/TEAM_MEMBER_REQ-002_FRONTEND_TEAM.md) | 前端：团队/成员管理页、邀请弹窗、接受邀请页、路由 | `dev`/`build` 通过，邀请→接受→成员可见闭环可用 |

## 5. 里程碑

1. ✅ REQ-001 后端团队与成员（本文档拆解）。
2. ✅ REQ-002 前端团队/成员管理闭环。
3. ⬜ 下游模块（api_key → usage_metering → …）复用 team/user 上下文。

## 6. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| T-01 | 多团队多角色（用户同时属于多个团队、角色随团队而异） | 首期「一个用户一个团队」，`TeamMember` 关联表方案留待需要时引入 |
| T-02 | 邀请邮件/短信通知 | 首期仅生成邀请链接/口令，由管理员自行分发；邮件通知依赖通知基建（system_admin）后续接入 |
| T-03 | 成员移除后其 API Key / 用量的归属处理 | 归属下游模块，移除时仅禁用成员关系，不做级联删除 |
| R-01 | 波及 `auth`（register/login 注入 teamId）与 `User` schema，需同步更新 REQ-001 既有测试 | 本次一并更新 |

## 7. 关联

- 上游：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`、`TENANT_AUTH_PLAN.md`
- feature：`docs/feature/team_member.md`
- 数据模型：`docs/technical/db_schema/TEAM_MEMBER_SCHEMA.MD`（本 plan 新增）、`docs/technical/db_schema/TENANT_USER_SCHEMA.MD`
- requirement：见 §4
