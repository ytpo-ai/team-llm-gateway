# 租户与用户数据模型（Tenant / User）

> 所属模块：`docs/feature/tenant_auth.md`；上游 plan：`docs/plan/TENANT_AUTH_PLAN.md`
>
> 本文件固化 `Tenant` / `User` 的 Mongoose Schema 定义，作为鉴权与租户上下文的单一事实来源。下游模块（team_member/api_key/usage_metering 等）引用此处的 `tenantId` 隔离约定。

---

## 1. 设计原则

- **多租户内建（ADR-03）**：所有业务集合携带 `tenantId` 引用 `Tenant`，查询一律按 `tenantId` 过滤。
- **单团队开源版 = 租户数=1 的特例**：默认租户 `code = 'default'`，由首次注册自举创建。
- **服务商/系统角色保留**：枚举预留，单团队版不暴露（见 §3）。

## 2. Tenant（租户）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `_id` | ObjectId | 主键 | 自动生成 |
| `code` | string | 必填、唯一、trim | 租户唯一标识，单团队版固定 `default` |
| `name` | string | 必填、trim | 租户显示名 |
| `status` | enum | `active` / `suspended`，默认 `active` | 租户状态 |
| `config` | Mixed | 可选 | 预留租户级配置（默认 `{}`） |
| `createdAt` | Date | 自动 | 创建时间 |
| `updatedAt` | Date | 自动 | 更新时间 |

## 3. User（用户）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `_id` | ObjectId | 主键 | 自动生成 |
| `tenantId` | ObjectId | 必填、ref `Tenant`、索引 | 所属租户 |
| `email` | string | 可选、小写、trim、默认 `null` | 登录邮箱，同一租户内非空唯一 |
| `passwordHash` | string | 可选、默认 `null` | bcrypt 哈希，绝不落明文；无密码的成员不可登录 |
| `name` | string | 必填、trim | 显示名 |
| `role` | enum | 见下方角色枚举，默认 `member` | RBAC 角色（角色A） |
| `roleTemplateId` | ObjectId | 可选、ref `RoleTemplate`、默认 `null` | 角色B（LLM 使用限制模板） |
| `status` | enum | `active` / `disabled`，默认 `active` | 用户状态 |
| `createdAt` | Date | 自动 | 创建时间 |
| `updatedAt` | Date | 自动 | 更新时间 |

**部分唯一索引**：`{ tenantId, email }` 使用 `partialFilterExpression: { email: { $type: 'string' } }`，保证同租户内非空邮箱唯一（多个成员无邮箱不冲突）。

### 角色枚举（Role）

| 值 | 说明 | 单团队版 |
|---|---|---|
| `system` | 系统管理员 | 可见 |
| `team_admin` | 团队管理员 | 可见 |
| `member` | 普通成员 | 可见 |

> 已废弃并移除：`finance` / `viewer` / `provider`（2026-11-02 团队管理优化 REQ-001）。

### 两层角色体系

| 层 | 名称 | 是否固定 | 掌管字段 | 说明 |
|---|---|---|---|---|
| 角色A（管理范围） | system / team_admin / member | 固定 | `User.role` | 决定「谁能做管理操作」 |
| 角色B（LLM 使用限制） | 设计师 / 开发人员 … | 不固定 | `User.roleTemplateId` | 决定「能用哪些渠道/多少额度」 |

- 角色B 数据模型见 `docs/technical/db_schema/ROLE_TEMPLATE_SCHEMA.MD`。

## 4. JWT Payload

```ts
interface JwtPayload {
  sub: string;      // 用户 _id
  email: string;    // 邮箱
  tenantId: string; // 所属租户 _id
  role: Role;       // 角色
}
```

- access：`jwt.secret` / `jwt.expiresIn`（短效）
- refresh：`jwt.refreshSecret` / `jwt.refreshExpiresIn`（长效）

## 5. 租户隔离约定

- 鉴权后，`tenantId` 从 JWT 解析注入请求上下文（`@CurrentUser()`）。
- 业务查询必须携带 `tenantId` 条件，禁止跨租户读写。
- 完整隔离策略随多租户模块（D-04）推进细化，本文档为基础约定。
