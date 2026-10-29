# SYSTEM_ADMIN_REQ-001 开发记录（后端系统配置 + 审计日志）

> 对应需求：`docs/requirement/SYSTEM_ADMIN_REQ-001_BACKEND_SYSTEM.md`
> 对应计划：`docs/plan/SYSTEM_ADMIN_PLAN.md`
> 分支：`main`

## 1. 实现摘要

落地「系统管理」后端：租户级系统配置（`SystemSetting`）+ 只增不改的审计流水（`AuditLog`），并在 billing/api-keys/models/providers/teams 关键写操作注入审计埋点，满足运营合规；服务商/系统角色在开源单团队版隐藏，仅 `team_admin` 可见。

- `SystemSetting`：`tenantId + key` 唯一，`value` JSON，`updatedBy` 记录最后修改人，upsert 语义。
- `AuditLog`：`tenantId/teamId/userId`（actor）+ `action/resourceType/resourceId/summary` + `before/after` 快照 + `ip/userAgent`，只增不改。
- `SystemSettingsService`：`GET /system/settings`（列表）、`PUT /system/settings`（批量 upsert）。
- `AuditService`：`log()` 埋点（内部捕获异常，审计失败不阻断业务）+ `GET /system/audit-logs`（分页 + action/resourceType/userId/时间范围筛选）。
- 审计埋点：billing（recharge/adjust）、api-keys（create/revoke/rotate）、models（create/disable）、providers（create/disable）、teams（成员角色变更/移除/邀请/撤销邀请）。
- 埋点采用**控制器层注入 `AuditService`**：控制器已有 `@CurrentUser()` 与 `@Req()`，无需改动各业务 service 签名，规避了 models/providers/teams 服务方法仅接收 `tenantId/teamId` 而无操作人信息的缺口。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `modules/system/schemas/system-setting.schema.ts` | `SystemSetting` schema（`tenantId+key` 唯一索引） |
| `modules/system/schemas/audit-log.schema.ts` | `AuditLog` schema + `AuditAction`/`AuditResourceType` 枚举 |
| `modules/system/dto/update-settings.dto.ts` | `UpdateSettingsDto`（`settings: Record<string, unknown>`） |
| `modules/system/dto/list-audit-logs-query.dto.ts` | 审计查询分页/筛选 DTO |
| `modules/system/system-settings.service.ts` | 配置读写 |
| `modules/system/audit.service.ts` | 审计埋点 + 查询 |
| `modules/system/system.controller.ts` | `GET/PUT /system/settings`、`GET /system/audit-logs`（`team_admin`） |
| `modules/system/system.module.ts` | 模块装配，导出 `SystemSettingsService`/`AuditService` |
| `modules/system/audit.service.spec.ts` | 单测（3 例） |
| `modules/system/system-settings.service.spec.ts` | 单测（2 例） |

### 修改

| 文件 | 说明 |
|---|---|
| `app.module.ts` | 注册 `SystemModule` |
| `billing/billing.controller.ts` + `billing.module.ts` | 注入 `AuditService`，recharge/adjust 埋点，导入 `SystemModule` |
| `api-keys/api-keys.controller.ts` + `api-keys.module.ts` | create/revoke/rotate 埋点 |
| `models/models.controller.ts` + `models.module.ts` | create/remove 埋点（改用 `@CurrentUser()` 全量 user） |
| `providers/providers.controller.ts` + `providers.module.ts` | create/remove 埋点 |
| `teams/teams.controller.ts` + `teams.module.ts` | 成员角色变更/移除/邀请/撤销邀请埋点 |

## 3. 踩坑记录

1. **`Type` 装饰器归属**：`@Type(() => Number)` 来自 `class-transformer` 而非 `class-validator`，首次导入 `class-validator` 报 `TS2305`，改为 `import { Type } from 'class-transformer'`。
2. **埋点位置选型**：models/providers/teams 的 service 写方法只接收 `tenantId/teamId` 字符串、无操作人信息，若在 service 层埋点需改动方法签名并波及既有单测；改在**控制器层**埋点（控制器有 `@CurrentUser()` + `@Req()`），零 service 签名改动、零既有单测改动，且统一拿到 `ip`/`userAgent`。
3. **审计失败不阻断业务**：`AuditService.log()` 内部 try/catch 吞掉写入异常并 `Logger.warn`，避免审计库异常影响充值/建 Key 等主流程；单测覆盖该兜底路径。
4. **循环依赖规避**：`SystemModule` 仅依赖 `MongooseModule.forFeature`，不 import `AuthModule`（`JwtAuthGuard`/`RolesGuard` 为无依赖类、`Reflector` 为核心提供者，可跨模块直接 `@UseGuards`），因此 billing/api-keys/teams 等 import `SystemModule` 不产生循环依赖。

## 4. 验证结果

- `pnpm --filter portal-backend lint`：0 errors / 0 warnings。
- `pnpm --filter portal-backend typecheck`：通过。
- `pnpm --filter portal-backend test`：71 passed（新增 system 5）。
- `pnpm --filter portal-backend build`：通过。

## 5. 关联

- feature：`docs/feature/system_admin.md`
- 上游：`docs/plan/SYSTEM_ADMIN_PLAN.md` §3、`docs/technical/db_schema/SYSTEM_ADMIN_SCHEMA.MD`
