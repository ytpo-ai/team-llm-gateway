# TENANT_AUTH_REQ-001 后端租户与认证基础

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/tenant_auth.md` |
| 所属 plan | `docs/plan/TENANT_AUTH_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/tenant-auth-backend` |
| 状态 | `已交付` |

## 2. 需求描述

### 背景
`modules/auth/` 目前仅按邮箱签发 JWT，无真实用户/租户/密码校验。需落地租户与认证后端基础，作为所有业务模块的鉴权与租户上下文来源。

### 目标
- `Tenant` / `User` Mongoose Schema（含 TypeScript 类型与 DTO）。
- 密码 bcrypt 哈希存储与校验。
- 租户初始化：首次注册引导创建默认租户 + 首个团队管理员。
- 认证接口：`register`（初始化/注册管理员）、`login`（邮箱+密码）、`refresh`（刷新令牌）、`profile`（当前用户）。
- JWT access + refresh（payload 含 `sub/email/tenantId/role`）。
- RBAC：角色枚举 + `JwtAuthGuard` / `RolesGuard` / `@Roles()` / `@CurrentUser()`。
- 预留 OIDC/OAuth 接口位（首期不实现）。

### 验收条件
- [x] `pnpm --filter portal-backend start:dev` 启动成功。
- [x] Swagger 可调用 `POST /auth/register`、`POST /auth/login`、`POST /auth/refresh`、`GET /auth/profile`。
- [x] 注册后 Mongo 落库 Tenant + User（密码为哈希，不落明文）。
- [x] 登录校验密码，签发 access+refresh；refresh 换取新 access。
- [x] `profile` 需携带有效 access token，返回当前用户信息。
- [x] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过。

## 3. 技术方案摘要
- 数据模型：`docs/technical/db_schema/TENANT_USER_SCHEMA.MD`。
- 密码：bcryptjs；令牌：@nestjs/jwt（access/refresh 双密钥，已在 config 中）。
- 鉴权：@nestjs/passport + passport-jwt，自定义守卫/装饰器。
- 参考 `docs/plan/TENANT_AUTH_PLAN.md` §3。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/TENANT_AUTH_REQ-001_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
