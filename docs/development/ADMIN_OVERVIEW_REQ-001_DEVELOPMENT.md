# ADMIN_OVERVIEW_REQ-001 开发记录（后端 admin 模块 + 超级管理员引导）

> 对应需求：`docs/requirement/ADMIN_OVERVIEW_REQ-001_BACKEND_ADMIN.md`
> 对应计划：`docs/plan/ADMIN_OVERVIEW_PLAN.md`
> 分支：`main`

## 1. 实现摘要

落地「服务商全局视角」后端：服务商（`system`）角色 + 启动期超级管理员引导 + `admin` 模块（租户管理 + 全局看板），补齐 9 大模块最后一个，闭环 PORTAL_FOUNDATION 里程碑与 D-04 服务商部分。

- 服务商角色：复用 `Role.SYSTEM`；`User.tenantId` 改为可选（`default: null`），system 用户无团队归属。
- 引导机制：`SuperAdminBootstrapService`（`OnApplicationBootstrap`）读取 `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD`，按 `email + role=system` upsert，未配置则跳过。
- 认证适配：`AuthService.login()` 先全局查找 system 用户并分流；`resolveTeamId` 对 system 返回 `null`；`issueTokens` 接受 `teamId` 可空；`toPublicUser` 对空 `tenantId` 归一化为空串。
- `admin` 模块：租户管理（`GET/POST /admin/tenants`、`GET /admin/tenants/:id`、`PATCH /admin/tenants/:id/status`）+ 全局看板（`GET /admin/overview`、`GET /admin/overview/usage`），复用 `Tenant/Team/User/ApiKey/UsageLog` 模型，不新增集合。
- RBAC：`@Roles(Role.SYSTEM)`，admin 端点全局查询，不复用租户过滤。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `modules/admin/admin.service.ts` | 租户列表/详情/创建/启停 + 全局看板聚合（按租户用量拆分） |
| `modules/admin/admin.controller.ts` | `/admin/*` 端点（`@Roles(Role.SYSTEM)`） |
| `modules/admin/super-admin-bootstrap.service.ts` | 超级管理员引导 |
| `modules/admin/admin.module.ts` | 模块装配（`MongooseModule.forFeature` 5 个模型） |
| `modules/admin/dto/create-tenant.dto.ts` | `CreateTenantDto`（code/name） |
| `modules/admin/dto/update-tenant-status.dto.ts` | `UpdateTenantStatusDto`（status） |
| `modules/admin/dto/list-tenants-query.dto.ts` | 分页/筛选 DTO |
| `modules/admin/dto/overview-query.dto.ts` | `from`/`to` 时间范围 DTO |
| `modules/admin/admin.service.spec.ts` | 单测（7 例） |

### 修改

| 文件 | 说明 |
|---|---|
| `users/schemas/user.schema.ts` | `tenantId` 改为可选（`default: null`） |
| `users/users.service.ts` | 新增 `findSystemUserByEmail(email)` |
| `auth/auth.service.ts` | login 先查 system 用户分流；`resolveTeamId`/`issueTokens`/`toPublicUser` 适配空 teamId/tenantId |
| `auth/auth.service.spec.ts` | 补 `findSystemUserByEmail` mock + system 登录单测 |
| `config/configuration.ts` | 新增 `superAdmin.email/password` 配置 |
| `tenant/schemas/tenant.schema.ts` | 补 `createdAt/updatedAt` 类型声明 |
| `app.module.ts` | 注册 `AdminModule` |
| `.env.example` | 新增 `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` |

## 3. 踩坑记录

1. **`AuthUser.teamId` 保持 `string` 不变**：system 用户 JWT 中 `teamId/tenantId` 归一化为空串 `''`，避免将 `AuthUser.teamId` 改为 `string | null` 后波及 usage/billing 等十几处 `new Types.ObjectId(user.teamId)` 的类型；system 角色被 `RolesGuard` 拦在团队级端点之外，空串不会进入这些路径。
2. **登录分流顺序**：`login()` 先 `findSystemUserByEmail`（无 tenant 过滤），命中则走 `loginUser`；否则回退到既有 `ensureDefaultTenant + findByEmail` 流程，普通租户登录路径零改动、零回归。
3. **Mongo 唯一索引与 null**：`{ tenantId: 1, email: 1 }` 唯一索引在 `tenantId = null` 时 MongoDB 允许多个 null 值，system 用户不会与租户内用户邮箱冲突。
4. **复用模型、零新集合**：admin 模块直接 `MongooseModule.forFeature` 挂载 Tenant/Team/User/ApiKey/UsageLog，`toTenantView` 用 `Promise.all(countDocuments)` 聚合计数；单测中 `countDocuments` 需 mock 为 `{ exec: ... }` 查询对象。

## 4. 验证结果

- `pnpm --filter portal-backend lint`：0 errors / 0 warnings。
- `pnpm --filter portal-backend typecheck`：通过。
- `pnpm --filter portal-backend test`：79 passed（新增 admin 7 + auth system 登录 1）。
- `pnpm --filter portal-backend build`：通过。

## 5. 关联

- feature：`docs/feature/admin_overview.md`
- 上游：`docs/plan/ADMIN_OVERVIEW_PLAN.md` §3、`docs/technical/db_schema/ADMIN_OVERVIEW_SCHEMA.MD`
