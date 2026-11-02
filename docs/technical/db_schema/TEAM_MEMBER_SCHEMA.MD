# 团队与成员数据模型（Team / Invitation）

> 所属模块：`docs/feature/team_member.md`；上游 plan：`docs/plan/TEAM_MEMBER_PLAN.md`
>
> 本文件固化 `Team` / `Invitation` 的 Mongoose Schema 定义，并说明对 `User`（见 `TENANT_USER_SCHEMA.MD`）的增量变更，作为团队与成员模块的单一事实来源。

---

## 1. 设计原则

- **多租户内建（ADR-03）**：`Team` 携带 `tenantId` 引用 `Tenant`，查询一律按 `tenantId` 过滤。
- **单团队开源版 = 默认团队**：默认团队随默认租户自举创建（`name` 默认「默认团队」），首个管理员归属该团队。
- **邀请制加入**：成员由管理员邀请，凭一次性 token 注册成为成员；token 仅存哈希，绝不落明文。

## 2. Team（团队）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `_id` | ObjectId | 主键 | 自动生成 |
| `tenantId` | ObjectId | 必填、ref `Tenant`、索引 | 所属租户 |
| `name` | string | 必填、trim | 团队显示名 |
| `status` | enum | `active` / `suspended`，默认 `active` | 团队状态 |
| `limitDaily` | number | 可选、默认 `null` | 团队日 token 上限（null = 不限） |
| `limitWeekly` | number | 可选、默认 `null` | 团队周 token 上限（null = 不限） |
| `limitMonthly` | number | 可选、默认 `null` | 团队月 token 上限（null = 不限） |
| `providerIds` | ObjectId[] | 默认 `[]`、ref `Provider` | 团队可用渠道白名单（空 = 全部） |
| `createdAt` | Date | 自动 | 创建时间 |
| `updatedAt` | Date | 自动 | 更新时间 |

**唯一索引**：`{ tenantId, name }`，保证同租户内团队名唯一。

## 3. User（用户）增量变更

在 `TENANT_USER_SCHEMA.MD` 基础上新增：

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `teamId` | ObjectId | 可选、ref `Team`、索引 | 所属团队；首期「一个用户一个团队」 |

- `role` 语义：成员在其所属团队内的角色（沿用现有角色枚举，见 `TENANT_USER_SCHEMA.MD` §3）。
- 首个管理员注册时由 `ensureDefaultTeam` 回填 `teamId`。

## 4. Invitation（邀请）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `_id` | ObjectId | 主键 | 自动生成 |
| `teamId` | ObjectId | 必填、ref `Team`、索引 | 目标团队 |
| `email` | string | 必填、小写、trim | 受邀者邮箱 |
| `role` | enum | 必填 | 受邀后角色（`team_admin`/`member`/`finance`/`viewer`） |
| `tokenHash` | string | 必填 | 邀请 token 的 sha256 哈希（明文不外存） |
| `expiresAt` | Date | 必填 | 过期时间（默认 7 天） |
| `status` | enum | `pending` / `accepted` / `revoked`，默认 `pending` | 邀请状态 |
| `invitedBy` | ObjectId | 必填、ref `User` | 发起邀请的管理员 |
| `createdAt` | Date | 自动 | 创建时间 |
| `updatedAt` | Date | 自动 | 更新时间 |

**复合索引**：`{ teamId, email }`（配合服务层逻辑保证同团队同邮箱仅有唯一生效的 pending 邀请）。

## 5. 邀请流程时序

```
管理员(team_admin)
  └─ POST /teams/:id/invitations { email, role }
        → 生成 token(明文仅返回一次) + tokenHash 落库 + 返回邀请链接 /invite?token=<token>

受邀者(未登录)
  └─ 打开邀请链接 → 填写 name + password（邮箱取自邀请）
        → POST /auth/accept-invite { token, name, password }
              → 校验 token 有效/未过期/未使用
              → 创建 User(tenantId 取自 team.tenantId, teamId, role 取自邀请)
              → 邀请 status → accepted
              → 签发 access/refresh，返回登录态
```

## 6. JWT Payload 扩展

```ts
interface JwtPayload {
  sub: string;      // 用户 _id
  email: string;    // 邮箱
  tenantId: string; // 所属租户 _id
  teamId: string;   // 所属团队 _id（新增）
  role: Role;       // 角色
}
```

- `AuthUser`（`@CurrentUser()`）同步扩展 `teamId`，供业务模块做团队内鉴权与隔离。
