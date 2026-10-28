# TENANT_AUTH_REQ-001 开发记录（后端租户与认证基础）

> 对应需求：`docs/requirement/TENANT_AUTH_REQ-001_BACKEND_AUTH.md`
> 对应计划：`docs/plan/TENANT_AUTH_PLAN.md`
> 分支：`feat/tenant-auth-backend`（提交 `6488ab7`）

## 1. 实现摘要

将 `modules/auth/` 从「仅签发 JWT 的占位」落地为完整的租户 + 本地账号认证后端基础，包含：

- `Tenant` / `User` Mongoose Schema（含 TypeScript 类型与 DTO）。
- 密码 bcrypt 哈希存储与校验（bcryptjs，纯 JS 无原生依赖）。
- 租户初始化：首次注册自举默认租户（`code=default`）+ 首个团队管理员。
- 认证接口：`register` / `login` / `refresh` / `profile`。
- JWT access（`jwt.secret`）+ refresh（`jwt.refreshSecret` 独立密钥），payload 含 `sub/email/tenantId/role`。
- RBAC：`Role` 枚举 + `JwtAuthGuard` / `RolesGuard` / `@Roles()` / `@CurrentUser()`。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `src/common/enums/role.enum.ts` | `Role` 枚举（team_admin/member/finance/viewer + provider/system） |
| `src/modules/tenant/schemas/tenant.schema.ts` | `Tenant` schema（code 唯一 + name + status + config） |
| `src/modules/tenant/tenant.service.ts` | `ensureDefaultTenant(name?)`：查 `default` 租户，不存在则创建 |
| `src/modules/tenant/tenant.module.ts` | 注册 `Tenant` Model |
| `src/modules/users/schemas/user.schema.ts` | `User` schema（tenantId+email 唯一复合索引，passwordHash，role，status） |
| `src/modules/users/users.service.ts` | `findByEmail` / `findById` / `create` |
| `src/modules/users/users.module.ts` | 注册 `User` Model |
| `src/modules/auth/dto/register.dto.ts` | 注册 DTO（name/email/password/tenantName?） |
| `src/modules/auth/dto/refresh-token.dto.ts` | 刷新 DTO（refreshToken） |
| `src/modules/auth/guards/jwt-auth.guard.ts` | `AuthGuard('jwt')` 封装 |
| `src/modules/auth/guards/roles.guard.ts` | 读取 `@Roles()` 元数据校验角色 |
| `src/modules/auth/decorators/roles.decorator.ts` | `@Roles(...roles)` |
| `src/modules/auth/decorators/current-user.decorator.ts` | `@CurrentUser()` / `@CurrentUser('id')` |
| `src/modules/auth/auth.service.spec.ts` | AuthService 单测 7 例（register/login/refresh） |

### 修改

| 文件 | 说明 |
|---|---|
| `src/modules/auth/auth.service.ts` | 完整实现 register/login/refresh/getProfile/issueTokens |
| `src/modules/auth/auth.controller.ts` | 绑定 4 个接口 + Swagger 注解 |
| `src/modules/auth/auth.module.ts` | 装配 JwtModule/TenantModule/UsersModule/Passport |
| `src/modules/auth/strategies/jwt.strategy.ts` | 从 JWT payload 提取 `AuthUser`（id/email/tenantId/role） |
| `src/modules/auth/dto/login.dto.ts` | 补 Swagger ApiProperty |
| `src/common/filters/http-exception.filter.ts` | 非 `HttpException` 记录堆栈日志 |
| `apps/portal-backend/package.json` | 新增 `bcryptjs` 依赖 |

## 3. 踩坑记录

1. **Mongoose 9 字符串枚举被 `SchemaFactory` 误解析为嵌套 schema**：`@Prop({ enum: Object.values(X) })` 未显式指定 `type` 时，`design:type` 元数据把枚举对象当成嵌套 schema，报错 `active is not a valid type at path ACTIVE`。修复：枚举字段显式加 `type: String`。
2. **本地 MongoDB 开启鉴权**：默认 `mongodb://127.0.0.1:27017/portal` 无凭据导致 `Command find requires authentication`。冒烟验证改用临时无鉴权 Mongo 容器（端口 27018）完成，属环境问题非代码缺陷。

## 4. 验证结果

- `pnpm --filter portal-backend lint`：0 warnings / 0 errors。
- `pnpm --filter portal-backend typecheck`：通过。
- `pnpm --filter portal-backend test`：2 个测试文件 / 8 个用例全部通过。
- `pnpm --filter portal-backend build`：通过。
- 冒烟验证（临时 Mongo，无鉴权）：
  - `register` → 200，返回 user + access/refresh token，落库 Tenant(code=default) + User(passwordHash 为 bcrypt)。
  - `login` → 200；错误密码 → 401；重复注册 → 409。
  - `profile`（带 access）→ 200 返回当前用户；无 token → 401。
  - `refresh` → 200 换取新 access/refresh。

## 5. 关联

- feature：`docs/feature/tenant_auth.md`
- 数据模型：`docs/technical/db_schema/TENANT_USER_SCHEMA.MD`
- 待决事项：R-01（refresh 轮换/吊销）、R-02（服务商/系统角色）、R-03（OIDC/OAuth）见 `docs/plan/TENANT_AUTH_PLAN.md` §6。
