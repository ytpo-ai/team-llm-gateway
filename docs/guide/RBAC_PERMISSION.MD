# 系统管理员与团队管理员权限对照（RBAC）

> 定位：固化 `system`（系统管理员）与 `team_admin`（团队管理员）两个角色的能力边界，作为权限判定的单一事实来源。
>
> 依据：`apps/portal-backend/src/modules/*/*.controller.ts` 的 `@Roles` 装饰器、`auth/guards/roles.guard.ts` 的角色等级、前端 `app-layout.tsx` 菜单门控与各 service 层作用域。
>
> 关联：`docs/technical/db_schema/TENANT_USER_SCHEMA.MD`（角色枚举与两层角色）、`docs/feature/tenant_auth.md`、`docs/feature/system_admin.md`。

---

## 1. 角色体系

### 1.1 两层角色

| 层 | 名称 | 是否固定 | 掌管字段 | 决定什么 |
|---|---|---|---|---|
| 角色A（管理范围） | `system` / `team_admin` / `member` | 固定 | `User.role` | 「谁能做管理操作」 |
| 角色B（LLM 使用限制） | 设计师 / 开发人员 … | 不固定 | `User.roleTemplateId` | 「能用哪些渠道/多少额度」 |

- 本文档只讨论**角色A（管理范围）**。角色B 是 LLM 使用限额模板，与「管理权限」无关，见 `ROLE_TEMPLATE_SCHEMA.MD`。

### 1.2 角色等级与判定规则

`RolesGuard` 用数值等级比较（`userRank >= requiredRank`）：

| 角色 | 等级 | 含义 |
|---|---|---|
| `system` | 3 | 系统管理员（服务商/超级管理员），最高 |
| `team_admin` | 2 | 团队管理员 |
| `member` | 1 | 普通成员 |

由此，`@Roles(X)` 的**实际放行范围**：

| 装饰器写法 | 放行角色 | 备注 |
|---|---|---|
| `@Roles(SYSTEM)` | 仅 `system` | 系统专属 |
| `@Roles(TEAM_ADMIN)` | `team_admin` + `system` | 「团队管理员及以上」 |
| `@Roles(TEAM_ADMIN, SYSTEM)` | `team_admin` + `system` | 等价于上一行 |
| `@Roles(MEMBER)` | `member` + `team_admin` + `system` | 「成员及以上」 |
| 仅 `@UseGuards(JwtAuthGuard)`（无 `RolesGuard`） | 任意已登录用户 | 由 service 层按角色细分作用域 |

### 1.3 角色来源与形态

| 角色 | 如何产生 | tenantId/teamId | 视野 |
|---|---|---|---|
| `system` | ① `register` 自注册（仅系统未初始化时；创建 `Role.SYSTEM`）；② `SUPER_ADMIN_EMAIL/PASSWORD` 启动引导 upsert | 可为空（跨租户） | 全局/多租户 |
| `team_admin` | 团队管理员邀请/直接添加成员时指定；或注册后被调整 | 必填（归属某团队） | 单团队 |
| `member` | 邀请/直接添加成员 | 必填 | 单团队（仅本人数据） |

---

## 2. 权限总览（system vs team_admin）

> 图例：✅ 允许　❌ 禁止　◐ 受限（仅本人/本团队范围）

| 能力域 | system | team_admin | 说明 |
|---|---|---|---|
| 多租户切换（客户团队选择器） | ✅ | ❌ | 前端 `isSystem` 门控 |
| 创建团队 | ✅ | ❌ | `POST /teams` 仅 system |
| 更新团队（名称/策略集等） | ✅ | ✅ | |
| 成员：查看 / 添加 / 改角色 / 移除 / 邀请 / 撤销邀请 | ✅ | ✅ | |
| 角色模板（角色B）增删改 | ✅ | ✅ | |
| 策略集增删改 | ✅ | ✅ | |
| API Key：查看/签发/改绑/吊销/轮换 | ✅（全租户） | ✅（本团队） | member 仅本人 |
| 渠道（provider）管理 | ✅ | ✅ | |
| 模型目录增删改/禁用启用 | ✅ | ✅ | |
| 用量看板 / 使用日志 | ✅（全租户） | ✅（本团队） | member 仅本人 |
| 余额 / 流水（只读） | ✅（全租户） | ✅（本团队） | member 仅本人 |
| 充值 / 调整额度 | ✅ | ❌ | 仅 system |
| 系统设置（通知/审计/默认模型等） | ✅ | ❌ | 仅 system |
| 货币汇率配置（写） | ✅ | ❌ | 仅 system（读：member 及以上） |
| 审计日志 | ✅ | ✅ | |
| 租户管理 / 全局看板 | ✅ | ❌ | 仅 system（服务商） |

---

## 3. 分模块权限明细

### 3.1 认证（auth）

| 接口 | system | team_admin | 备注 |
|---|---|---|---|
| `GET /auth/init-status` | ✅ | ✅ | 公开，返回 `{ initialized }` |
| `POST /auth/register` | ✅ | ✅ | 公开；**仅系统未初始化时可用**（已初始化返回 403），注册者为 system |
| `POST /auth/login` / `refresh` | ✅ | ✅ | 公开 |
| `POST /auth/accept-invite` | ✅ | ✅ | 公开（凭邀请 token） |
| `GET /auth/profile` | ✅ | ✅ | 仅本人 |
| `POST /auth/change-password` | ✅ | ✅ | 仅本人 |

### 3.2 团队与成员（teams）

| 接口 | system | team_admin | 备注 |
|---|---|---|---|
| `GET /teams` | ✅ | ✅ | 成员及以上 |
| `POST /teams` | ✅ | ❌ | **仅 system** |
| `PATCH /teams/:teamId` | ✅ | ✅ | |
| `GET /teams/:teamId/members` | ✅ | ✅ | |
| `POST /teams/:teamId/members` | ✅ | ✅ | 直接添加成员 |
| `PATCH /teams/:teamId/members/:userId` | ✅ | ✅ | 改角色/状态 |
| `DELETE /teams/:teamId/members/:userId` | ✅ | ✅ | 移除（禁用） |
| `POST /teams/:teamId/invitations` | ✅ | ✅ | 邀请 |
| `GET /teams/:teamId/invitations` | ✅ | ✅ | 邀请列表 |
| `DELETE /teams/:teamId/invitations/:invitationId` | ✅ | ✅ | 撤销邀请 |

### 3.3 角色模板与策略集（role-templates / policy-sets）

| 接口 | system | team_admin | 备注 |
|---|---|---|---|
| `GET /role-templates`、`GET /role-templates/:id` | ✅ | ✅ | 成员及以上可读 |
| `POST/PATCH/DELETE /role-templates` | ✅ | ✅ | |
| `GET /policy-sets`、`GET /policy-sets/:id` | ✅ | ✅ | 成员及以上可读 |
| `POST/PATCH/DELETE /policy-sets` | ✅ | ✅ | |

### 3.4 API Key（api-keys）

- 无 `RolesGuard`，全部走 `JwtAuthGuard` + service 层按角色细分作用域：

| 角色 | 范围 |
|---|---|
| `member` | 仅本人的 key |
| `team_admin` | 本团队全部 key，可指定绑定本团队任意成员 |
| `system` | 全租户全部 key，可跨团队绑定 |

### 3.5 模型与渠道（models / providers）

| 接口 | system | team_admin | 备注 |
|---|---|---|---|
| `GET /models`、`GET /models/presets`、`GET /models/:id` | ✅ | ✅ | 成员及以上可读 |
| `POST /models`、`POST /models/bulk`、`PATCH`、`disable`、`enable`、`DELETE` | ✅ | ✅ | 写操作团队管理员及以上 |
| `providers` 全量（CRUD / test / from-preset） | ✅ | ✅ | 类级 `@Roles(TEAM_ADMIN)` |

### 3.6 用量与计费（usage / billing）

| 接口 | system | team_admin | 备注 |
|---|---|---|---|
| `GET /usage/*`（summary/trends/by-model/by-member/by-key/logs） | ✅（全租户） | ✅（本团队） | service 层细分：member 仅本人 |
| `GET /billing/accounts` | ✅（全租户） | ✅（本团队） | member 仅本人 |
| `GET /billing/transactions` | ✅（全租户） | ✅（本团队） | member 仅本人 |
| `POST /billing/recharge` | ✅ | ❌ | **仅 system** |
| `POST /billing/adjust` | ✅ | ❌ | **仅 system** |

### 3.7 系统管理（system）

| 接口 | system | team_admin | 备注 |
|---|---|---|---|
| `GET /system/settings` | ✅ | ❌ | **仅 system** |
| `PUT /system/settings` | ✅ | ❌ | **仅 system** |
| `GET /system/currency` | ✅ | ✅ | member 及以上可读 |
| `PUT /system/currency` | ✅ | ❌ | **仅 system** |
| `GET /system/audit-logs` | ✅ | ✅ | 团队管理员及以上 |

### 3.8 服务商全局（admin，仅 system）

| 接口 | system | team_admin |
|---|---|---|
| `GET /admin/tenants`、`GET /admin/teams`、`GET /admin/tenants/:id` | ✅ | ❌ |
| `POST /admin/tenants`、`PATCH /admin/tenants/:id/status` | ✅ | ❌ |
| `GET /admin/overview`、`GET /admin/overview/usage` | ✅ | ❌ |

### 3.9 其他

| 接口 | system | team_admin | 备注 |
|---|---|---|---|
| `GET /recommendations/scenarios`、`/scenarios/:id` | ✅ | ✅ | 成员及以上 |
| `GET /health` | ✅ | ✅ | 公开 |
| `/v1/*`（LLM 转发） | — | — | 走 `ApiKeyAuthGuard`（API Key 鉴权，非用户角色） |

---

## 4. 前端菜单可见性

来源：`apps/portal-frontend/src/components/layout/app-layout.tsx`。

| 分组 | 菜单项 | system | team_admin | member |
|---|---|---|---|---|
| 团队管理 | 成员管理 / 角色管理 / 策略管理 / API Key / 选型建议 | ✅ | ✅ | ✅（页面内写操作按 `isAdmin` 隐藏） |
| LLM管理 | 渠道管理 | ✅ | ✅ | ❌ |
| LLM管理 | 模型管理 | ✅ | ✅ | ✅（写操作按 `isAdmin` 隐藏） |
| 观察 | 用量看板 / 余额/流水 | ✅ | ✅ | ✅ |
| 观察 | 使用日志 | ✅ | ✅ | ❌ |
| 观察 | 审计日志 | ✅ | ✅ | ❌ |
| 系统管理 | 系统设置 | ✅ | ❌ | ❌ |
| 系统管理 | 额度管理 | ✅ | ❌ | ❌ |
| 系统管理 | 租户管理 / 全局看板 | ✅ | ❌ | ❌ |

> 说明：前端菜单只做「入口显隐」，真正的权限由后端 `RolesGuard` 兜底。即使 `team_admin` 直接访问被隐藏路由（如 `/settings`、`/quota-topup`），后端也会返回 403。

---

## 5. 差异要点总结

**system 独有（team_admin 不具备）**
1. 多租户视野：客户团队（租户）选择器、跨租户/跨团队读写。
2. 创建团队（`POST /teams`）。
3. 充值 / 调整额度（`POST /billing/recharge`、`/adjust`）。
4. 系统设置读写（`GET/PUT /system/settings`）。
5. 货币汇率配置写（`PUT /system/currency`）。
6. 服务商全局管理（`/admin/*`：租户管理、全局看板）。

**team_admin 具备（在单团队内，与 system 一致的管理能力）**
- 团队成员全生命周期管理（添加/改角色/移除/邀请/撤销）。
- 角色模板、策略集、渠道、模型目录的增删改。
- 本团队 API Key 全量管理。
- 本团队用量、余额/流水、审计日志的查看。

**两者都不可越权**
- 角色等级只允许「放宽到更高级别」，不允许低级别角色触达更高级别接口；`member` 永远无法执行上述管理操作。
