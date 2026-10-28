# 租户与认证模块开发计划（TENANT_AUTH）

> 本 plan 固化 Portal 首个业务模块 **租户与认证（tenant_auth）** 的工程方案，作为团队/成员/APIKey 等下游模块的基础。
>
> - 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-03 多租户内建、ADR-04 技术栈、§5.2 Portal 边界、§6）
> - 上游 plan：`docs/plan/PORTAL_FOUNDATION_PLAN.md`（里程碑 6 的首个模块）
> - 定稿时间：2026-10-28
> - 状态：已批准

---

## 1. 需求背景

Portal 工程骨架已就绪（REQ-001/002/003 已交付），`modules/auth/` 目前仅为占位（login 仅签发 JWT，无真实用户/租户/密码校验）。需先落地租户与认证模块，为后续所有业务模块提供「谁在哪个租户、什么角色」的上下文与鉴权能力。

## 2. 目标

1. 多租户模型内建：Tenant + User 数据模型，单团队开源版 = 租户数=1 的特例（tenantId 固定为默认租户）。
2. 本地账号认证：邮箱+密码（bcrypt 哈希）+ JWT(access+refresh)，预留 OIDC/OAuth 接口位。
3. RBAC 角色权限：团队管理员/成员/财务/只读 + 保留服务商/系统角色（单团队版隐藏）。
4. 前端登录/初始化闭环（REQ-002，本 plan 第二阶段）。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 数据模型 | `Tenant`（code 唯一 + 名称 + 状态）、`User`（tenantId + email + passwordHash + name + role + status），详见 `docs/technical/db_schema/TENANT_USER_SCHEMA.MD` |
| 密码 | bcryptjs（纯 JS，无原生依赖），哈希落库 |
| 令牌 | JWT access（短效，`jwt.secret`）+ refresh（长效，`jwt.refreshSecret`），payload = `{ sub, email, tenantId, role }` |
| 鉴权 | Passport JWT + 自定义 `JwtAuthGuard` / `RolesGuard` / `@Roles()` / `@CurrentUser()` |
| 租户隔离 | 请求上下文以 JWT 中的 `tenantId` 为准，数据查询按 `tenantId` 过滤（D-04 的落地起点） |
| 初始化 | 首次注册时引导创建默认租户 + 首个团队管理员（开源单团队版的自举流程） |

## 4. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [TENANT_AUTH_REQ-001](../requirement/TENANT_AUTH_REQ-001_BACKEND_AUTH.md) | 后端：Tenant/User schema、密码哈希、租户初始化、注册/登录/刷新/资料、RBAC | `start:dev` 启动，Swagger 可调 `register`/`login`/`refresh`/`profile`，Mongo 落库，lint/typecheck/test 通过 |
| [TENANT_AUTH_REQ-002](../requirement/TENANT_AUTH_REQ-002_FRONTEND_AUTH.md) | 前端：初始化/登录页、认证状态(Zustand)+路由守卫+refresh 续期 | `dev`/`build` 通过，登录闭环可用 |

## 5. 里程碑

1. ✅ REQ-001 后端租户与认证（本文档拆解）。
2. ✅ REQ-002 前端认证闭环（已交付）。
3. 🔄 下游模块（team_member 进行中 → api_key → …）复用 tenant/user 上下文。

## 6. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| D-04 | 多租户隔离细节（tenantId 共享库 + 查询过滤） | 本 plan 以「JWT 携带 tenantId + 查询按 tenantId 过滤」起步，完整隔离策略随多租户模块推进细化 |
| R-01 | refresh token 轮换/吊销（黑名单/版本号） | 首期采用独立密钥的 refresh JWT（stateless），完整轮换留待后续 |
| R-02 | 服务商/系统角色与全局视角 | 保留枚举位，单团队版不暴露，SaaS 形态后续启用 |
| R-03 | OIDC/OAuth 接入 | 仅预留接口位，首期本地账号 |

## 7. 关联

- 上游：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`、`PORTAL_FOUNDATION_PLAN.md`
- feature：`docs/feature/tenant_auth.md`
- 数据模型：`docs/technical/db_schema/TENANT_USER_SCHEMA.MD`
- requirement：见 §4
