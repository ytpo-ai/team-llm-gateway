# 服务商全局视角开发计划（ADMIN_OVERVIEW）

> 本 plan 固化 Portal 最后一个基础模块 **服务商全局视角（admin_overview）** 的工程方案，落地 `SYSTEM_POSITIONING_AND_ARCHITECTURE.MD` §5.3 中多租户管理、服务商全局看板、客户团队托管接入三项职责。
>
> - 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-03、§2.2、§5.3）
> - 上游 plan：`docs/plan/PORTAL_FOUNDATION_PLAN.md`（9 大模块清单）
> - 定稿时间：2026-10-29
> - 状态：已完成

---

## 1. 需求背景

9 大模块已有 8 个闭环（tenant_auth → team_member → api_key → model_provider → usage_metering → billing_quota → model_recommendation → system_admin），剩余最后一个 **服务商全局视角**。该模块仅在超级 Portal（SaaS）形态启用，开源单团队版隐藏（租户数 = 1 特例，见 ADR-03）。核心诉求：服务商（`system` 角色）可管理多个租户、查看全局看板，并支持客户团队托管接入。

## 2. 目标

1. 引入**服务商（超级管理员）角色**：复用已存在的 `Role.SYSTEM`，新增启动期引导（bootstrap）机制种入超级管理员（跨租户、无 `tenantId/teamId`）。
2. 新增 `admin` 模块：租户管理（列表/详情/创建/启停）+ 全局看板（全局总量 + 按租户用量拆分）。
3. REST API（全部 `system` 角色）：`GET/POST /admin/tenants`、`GET /admin/tenants/:id`、`PATCH /admin/tenants/:id/status`、`GET /admin/overview`、`GET /admin/overview/usage`。
4. 前端：租户管理页 `/admin/tenants` + 全局看板页 `/admin/overview`，路由/导航接入（仅 `system` 可见）。
5. 闭环 PORTAL_FOUNDATION 里程碑（9 大模块全量）与 D-04「多租户设计细节」的服务商部分。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 服务商角色 | 复用 `Role.SYSTEM`（`system`），`User.tenantId` 改为可选（`default: null`），system 用户无团队归属 |
| 引导机制 | `SuperAdminBootstrapService`（`OnApplicationBootstrap`）：读取 `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD`，未设置则跳过；已设置则按邮箱 upsert 一个 `system` 角色用户（bcrypt 哈希） |
| 认证适配 | `AuthService.login()` 先全局查找 system 用户；`resolveTeamId` 对 system 角色返回 `null`；`issueTokens` 接受 `teamId: ObjectId \| null`，system 用户 JWT `tenantId/teamId` 为空串 |
| 租户管理 | 复用 `Tenant`（已有 `status` active/suspended + `config`）schema，不新增集合；`admin` 服务聚合 Team/User/ApiKey 计数 |
| 全局看板 | `overview`：Tenant/Team/User/ApiKey 计数 + UsageLog 聚合（token/cost/request，默认 30 天）；`overview/usage`：按 `tenantId` 分组聚合 |
| 鉴权 | 复用 `JwtAuthGuard` + `RolesGuard` + `@Roles(Role.SYSTEM)`；admin 端点全局查询，不复用租户过滤 |
| 租户创建 | `POST /admin/tenants` 创建 `Tenant` 并 `TeamsService.ensureDefaultTeam` 建默认团队（托管接入入口） |

## 4. RBAC 设计

| 资源 | 读 | 写 |
|---|---|---|
| `admin/tenants` | `system` | `system`（创建/启停） |
| `admin/overview` | `system` | 无（只读聚合） |

> 非 `system` 角色访问 `/admin/*` 由 `RolesGuard` 拦截；`system` 角色无法访问团队级端点（其角色不在任何既有 `@Roles` 白名单内），实现前后端一致的权限隔离。

## 5. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [ADMIN_OVERVIEW_REQ-001](../requirement/ADMIN_OVERVIEW_REQ-001_BACKEND_ADMIN.md) | 后端：`admin` 模块（租户管理 + 全局看板）+ 超级管理员引导 + `teamId/tenantId` 可选化认证改造 + 单测 | `start:dev` 启动，Swagger 可调 `/admin/*`，`system` 账号可登录并调用 admin 端点，普通角色被拦截，lint/typecheck/test 通过 |
| [ADMIN_OVERVIEW_REQ-002](../requirement/ADMIN_OVERVIEW_REQ-002_FRONTEND_ADMIN.md) | 前端：租户管理页 `/admin/tenants` + 全局看板页 `/admin/overview` + 路由/导航接入（`system` 可见） | `dev`/`build` 通过，`system` 账号可见「全局」导航并可管理租户/查看看板，普通角色不可见 |

## 6. 里程碑

1. ✅ REQ-001 后端 admin 模块 + 超级管理员引导（本文档拆解）。
2. ✅ REQ-002 前端租户管理 + 全局看板闭环。
3. ✅ 9 大模块全量交付（PORTAL_FOUNDATION 里程碑闭环 + D-04 服务商部分）。

## 7. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| R-01 | `User.tenantId` 可选化 + `login` 分流会触碰认证链路 | 需跑通全部单测/lint/typecheck 防回归登录/注册/刷新流程 |
| R-02 | system 角色与团队级端点的权限边界 | 靠 `RolesGuard` 白名单隔离，system 不在任何团队级 `@Roles` 中 |
| R-03 | 超级管理员引导仅支持环境变量方式 | 首期 env 引导，CLI seed 后续按需补充 |
| D-04 | 超级 Portal 与单团队 Portal 的多租户设计细节 | 本 plan 闭环「服务商角色 + 租户隔离」部分，客户托管接入的完整计费插件后续 |

## 8. 关联

- 上游：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（§2.2/§5.3、ADR-03）
- feature：`docs/feature/admin_overview.md`
- requirement：见 §5
