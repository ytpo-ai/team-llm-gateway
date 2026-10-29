# 服务商全局视角数据模型（ADMIN_OVERVIEW）

> 所属模块：`docs/feature/admin_overview.md`；上游 plan：`docs/plan/ADMIN_OVERVIEW_PLAN.md`
>
> 本文件固化「服务商全局视角」的**数据契约**。该模块**不新增集合**，复用 `Tenant`（多租户管理）与 `UsageLog`（全局用量聚合），并新增服务商（`system`）角色的用户归属约定。

---

## 1. 设计原则

- **多租户内建（ADR-03）**：Portal 核心按多租户设计，超级 Portal（SaaS）是租户数 = N 的形态；服务商角色跨租户、无单一 `tenantId`。
- **服务商角色复用 `Role.SYSTEM`**：`system` 用户的 `tenantId/teamId` 均为空（`null`），仅可访问 `/admin/*`。
- **不新增集合**：租户状态管理复用 `Tenant.status`（active/suspended），全局看板复用 `UsageLog` 聚合。

## 2. Tenant（多租户，复用）

> Schema 定义见 `apps/portal-backend/src/modules/tenant/schemas/tenant.schema.ts`。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `_id` | ObjectId | 主键 | 自动生成 |
| `code` | string | 必填、唯一、trim | 租户编码（托管接入唯一标识） |
| `name` | string | 必填、trim | 租户名称 |
| `status` | enum | 默认 `active` | `active` / `suspended`（启停） |
| `config` | Mixed | 默认 `{}` | 预留租户级配置 |
| `createdAt` / `updatedAt` | Date | 自动 | 时间戳 |

## 3. User（服务商角色归属约定）

| 字段 | 变更 | 说明 |
|---|---|---|
| `tenantId` | 改为可选（`default: null`） | `system` 用户为 `null`，其余用户必填 |
| `teamId` | 已是可选 | `system` 用户为 `null` |
| `role` | 复用 `system` | 服务商/超级管理员角色 |

**索引**：`{ tenantId: 1, email: 1 }` 唯一索引在 `tenantId = null` 时等价于「邮箱 + system 角色」全局唯一（MongoDB 唯一索引允许多个 null 值）。

## 4. 服务商引导契约（SuperAdminBootstrapService）

- 环境变量：`SUPER_ADMIN_EMAIL`、`SUPER_ADMIN_PASSWORD`（二者均设置才启用）。
- 启动期（`OnApplicationBootstrap`）：按 `email + role=system` 查找，不存在则创建（`passwordHash` 用 bcrypt 哈希，`name = 超级管理员`，`status = active`）。
- 未配置则跳过并打日志，不影响正常启动。

## 5. 租户管理 API 契约（`/admin/tenants`，`system`）

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/admin/tenants` | 分页 + 筛选（`status`/`search`/`limit`/`offset`），返回 `{ items, total, limit, offset }`，`items` 含 `teamCount/memberCount/apiKeyCount` 计数 |
| `POST` | `/admin/tenants` | body `{ code, name }`，创建租户并初始化默认团队 |
| `GET` | `/admin/tenants/:id` | 租户详情（含 `config`） |
| `PATCH` | `/admin/tenants/:id/status` | body `{ status }`，启停租户 |

**租户视图（TenantView）**：

```ts
interface TenantView {
  id: string;
  code: string;
  name: string;
  status: 'active' | 'suspended';
  teamCount: number;
  memberCount: number;   // 排除 system 角色
  apiKeyCount: number;
  createdAt?: Date;
}
```

## 6. 全局看板 API 契约（`/admin/overview`，`system`）

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/admin/overview` | 全局总量：`tenantCount/teamCount/memberCount/apiKeyCount` + 用量聚合（`requestCount/totalTokens/totalCost`，默认近 30 天，`from`/`to` 可传） |
| `GET` | `/admin/overview/usage` | 按 `tenantId` 分组聚合（`requestCount/totalTokens/totalCost`）+ 租户名称，按 `totalTokens` 倒序 |

**用量聚合来源**：`UsageLog`（`totalTokens`/`cost`/`createdAt`），分组字段 `tenantId`。

## 7. 权限边界

- `system` 角色：仅 `/admin/*` 端点（`@Roles(Role.SYSTEM)`），全局查询。
- `system` 角色不在任何团队级 `@Roles` 白名单（team_admin/finance/member/viewer/provider）中，`RolesGuard` 自动拦截其访问团队级端点。
- 非 `system` 角色访问 `/admin/*` 被 `RolesGuard` 拦截（403）。
