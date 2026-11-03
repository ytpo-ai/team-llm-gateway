# BILLING_QUOTA_REQ-006 开发记录（策略数据模型 + 硬迁移）

> 对应需求：`docs/requirement/BILLING_QUOTA_REQ-006_POLICY_MODEL.md`
> 对应计划：`docs/plan/BILLING_QUOTA_POLICY_PLAN.md`
> 分支：`main`

## 1. 实现摘要

新增 `PolicySet`/`PolicyEntry` 策略数据模型与 `policy-sets` CRUD 模块，`Team`/`RoleTemplate`/`ApiKey` 通过 `policySetId` 引用挂载，并一次性硬迁移存量固定字段。

- 新增 `modules/policy-sets/`：`PolicySet` schema（`PolicyEntry` 内嵌子文档，`measure/window/action` 枚举、`limit ≥ 0`）、CRUD API（`GET/POST/PATCH/DELETE /policy-sets`）、DTO 校验（枚举合法、`limit ≥ 0`、同 measure+window 去重提示）、内置集不可删。
- 挂载字段：`Team.policySetId` / `RoleTemplate.policySetId` / `ApiKey.policySetId`（`null` = 不限）。
- 删除旧限制字段（硬迁移）：`Team.limitDaily/Weekly/Monthly/providerIds`、`RoleTemplate.limitDaily/Weekly/Monthly/rateLimitPerMinute/providerIds/modelWhitelist`、`ApiKey.allowedModels/rateLimitPerMinute/maxTokens/limitDaily/Weekly/Monthly/providerIds`。
- 硬迁移脚本 `PolicySetMigrationService`（`OnApplicationBootstrap`，幂等）：固定字段 → 等价策略条目 → 建/复用 PolicySet → 挂载 `policySetId` → `$unset` 旧字段；内置角色模板「设计师/开发人员」关联内置策略集（`builtIn=true`、`teamId=null`）。
- `AuditResourceType` 新增 `POLICY_SET`。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `modules/policy-sets/schemas/policy-set.schema.ts` | `PolicySet`/`PolicyEntry` schema + 枚举 |
| `modules/policy-sets/dto/policy-entry.dto.ts` | 策略条目 DTO |
| `modules/policy-sets/dto/create-policy-set.dto.ts` | 创建 DTO |
| `modules/policy-sets/dto/update-policy-set.dto.ts` | 更新 DTO |
| `modules/policy-sets/policy-sets.service.ts` | CRUD + 名称唯一 + 条目去重 |
| `modules/policy-sets/policy-sets.controller.ts` | `/policy-sets` 控制器 |
| `modules/policy-sets/policy-sets.module.ts` | 模块注册 |
| `modules/policy-sets/migrations/policy-set-migration.service.ts` | 幂等硬迁移 |
| `modules/policy-sets/policy-sets.service.spec.ts` | 单测 |

### 修改

| 文件 | 说明 |
|---|---|
| `teams/schemas/team.schema.ts` | 删旧字段、加 `policySetId` |
| `role-templates/schemas/role-template.schema.ts` | 删旧字段、加 `policySetId` |
| `api-keys/schemas/api-key.schema.ts` | 删旧字段、加 `policySetId` |
| `teams/teams.service.ts` + `dto/update-team.dto.ts` | 挂载策略集 |
| `role-templates/role-templates.service.ts` + `dto/*` + `role-template-seed.service.ts` | 挂载策略集 |
| `api-keys/api-keys.service.ts` + `dto/*` | 挂载策略集 |
| `system/schemas/audit-log.schema.ts` | 新增 `POLICY_SET` 资源类型 |
| `app.module.ts` | 注册 `PolicySetsModule` |

## 3. 踩坑记录

1. **Mongoose 读旧字段**：迁移在旧字段已从 schema 删除后仍要读取它们，改用原生 `collection.find().toArray()` / `collection.updateOne()`，绕过 schema 只读已声明字段的限制。
2. **内置模板双重 seed**：迁移服务与 `RoleTemplateSeedService` 均会 seed 内置模板，二者均以 `findOne` 判断存在后再建，保证幂等、避免重复。

## 4. 验证结果

- `pnpm --filter portal-backend typecheck`：通过。
- `pnpm --filter portal-backend lint`：0 errors / 0 warnings。
- `pnpm --filter portal-backend test`：166 tests 通过（含 policy-sets 单测）。

## 5. 关联

- feature：`docs/feature/billing_quota.md`、`docs/feature/team_member.md`、`docs/feature/api_key.md`
- 上游：`docs/plan/BILLING_QUOTA_POLICY_PLAN.md` §3、§6
