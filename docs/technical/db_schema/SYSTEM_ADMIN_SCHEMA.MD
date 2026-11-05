# 系统管理数据模型（SystemSetting / AuditLog）

> 所属模块：`docs/feature/system_admin.md`；上游 plan：`docs/plan/SYSTEM_ADMIN_PLAN.md`
>
> 本文件固化 `SystemSetting`（租户级 KV 配置）与 `AuditLog`（只增不改的审计流水）的 Mongoose Schema 定义，作为「系统管理」模块的单一事实来源。`AuditLog` 由各业务模块写操作进程内埋点写入（billing/api-keys/models/providers/teams）。

---

## 1. 设计原则

- **多租户内建（ADR-03）**：配置/审计携带 `tenantId`（+`teamId`），查询按租户/团队过滤。
- **配置 KV 化**：`SystemSetting` 为 `tenantId + key` 唯一的键值存储，`value` 存 JSON，upsert 语义，`updatedBy` 记录最后修改人。
- **审计只增不改**：`AuditLog` 只追加、不提供管理写接口，由各模块控制器进程内调用 `AuditService.log()` 写入。
- **服务商/系统角色隐藏**：开源单团队版中，系统配置仅 `system` 可读写，审计日志 `team_admin` 可读。

## 2. SystemSetting（系统配置）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `_id` | ObjectId | 主键 | 自动生成 |
| `tenantId` | ObjectId | 必填、ref `Tenant`、索引 | 所属租户 |
| `key` | string | 必填、trim | 配置键（如 `notification.quotaThreshold`） |
| `value` | Mixed | 必填 | 配置值（string / number / boolean / object） |
| `updatedBy` | ObjectId | 可选、ref `User`、默认 `null` | 最后修改人 |
| `createdAt` | Date | 自动 | 创建时间 |
| `updatedAt` | Date | 自动 | 更新时间 |

**索引**：
- 唯一索引 `{ tenantId: 1, key: 1 }`：同一租户同一配置键唯一。

**约定配置键（首发）**：

| key | 类型 | 说明 |
|---|---|---|
| `notification.quotaThreshold` | number | 成员余额低于该值时告警 |
| `notification.lowBalanceEmail` | string | 余额告警通知邮箱 |
| `audit.retentionDays` | number | 审计日志保留天数（预留，当前未强制执行） |
| `gateway.defaultModel` | string | 默认模型 |
| `billing.currency` | object | 点数↔货币汇率配置（`{ displayCurrency: string, rates: { code, name, pointsPerUnit }[] }`），见 `docs/plan/BILLING_QUOTA_CURRENCY_RATE_PLAN.md` |

## 3. AuditLog（审计流水）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `_id` | ObjectId | 主键 | 自动生成 |
| `tenantId` | ObjectId | 必填、ref `Tenant`、索引 | 所属租户 |
| `teamId` | ObjectId | 必填、ref `Team`、索引 | 所属团队 |
| `userId` | ObjectId | 必填、ref `User`、索引 | 操作人（actor） |
| `action` | enum | 必填、索引 | 动作：`create`/`update`/`disable`/`revoke`/`rotate`/`recharge`/`adjust`/`invite`/`invite_revoke`/`member_update`/`member_remove`/`currency_update` |
| `resourceType` | enum | 必填、索引 | 资源：`billing`/`api_key`/`model`/`provider`/`team`/`member`/`invitation`/`currency` |
| `resourceId` | string | 可选、默认 `null` | 资源标识（业务 id） |
| `summary` | string | 可选、默认 `null` | 人类可读摘要 |
| `before` | Mixed | 可选、默认 `null` | 变更前快照 |
| `after` | Mixed | 可选、默认 `null` | 变更后快照 |
| `ip` | string | 可选、默认 `null` | 来源 IP |
| `userAgent` | string | 可选、默认 `null` | 来源 UA |
| `createdAt` | Date | 自动 | 创建时间 |

**索引**：
- `{ tenantId: 1, createdAt: -1 }`：租户级时间序列。
- `{ tenantId: 1, teamId: 1, createdAt: -1 }`：团队级时间序列。
- `{ tenantId: 1, resourceType: 1, createdAt: -1 }`：按资源类型筛选。
- `{ tenantId: 1, userId: 1, createdAt: -1 }`：按操作人追溯。

## 4. 审计埋点契约（`AuditService.log`）

```ts
interface AuditEntryInput {
  tenantId: string;
  teamId: string;
  actorUserId: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string | null;
  summary?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}
```

**埋点位置（首发）**：

| 模块 | 动作 | resourceType | action |
|---|---|---|---|
| billing | 充值 / 调整 | `billing` | `recharge` / `adjust` |
| api-keys | 创建 / 吊销 / 轮换 | `api_key` | `create` / `revoke` / `rotate` |
| models | 创建 / 禁用 | `model` | `create` / `disable` |
| providers | 创建 / 禁用 | `provider` | `create` / `disable` |
| teams | 成员角色变更 / 移除 / 邀请 / 撤销邀请 | `member` / `invitation` | `member_update` / `member_remove` / `invite` / `invite_revoke` |
| system | 货币汇率配置更新 | `currency` | `currency_update` |

**容错**：`log()` 内部捕获写入异常，审计失败不阻断业务主流程（仅告警日志）。

## 5. 配置 API 契约

- `GET /system/settings`：返回 `[{ key, value, updatedBy, updatedAt }]`（`system`）。
- `PUT /system/settings`：body `{ settings: Record<string, unknown> }`，批量 upsert，返回更新后的列表（`system`）。

## 6. 审计查询 API 契约

- `GET /system/audit-logs`：分页 + 筛选，`team_admin`。
- 查询参数：`action`、`resourceType`、`userId`、`from`、`to`、`limit`（默认 50、上限 200）、`offset`。
- 返回：`{ items, total, limit, offset }`，`items` 按 `createdAt` 倒序。
