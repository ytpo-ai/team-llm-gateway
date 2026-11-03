# BILLING_QUOTA_REQ-006 策略数据模型 + 硬迁移

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/billing_quota.md`、`docs/feature/team_member.md`、`docs/feature/api_key.md` |
| 所属 plan | `docs/plan/BILLING_QUOTA_POLICY_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `main` |
| 状态 | `done` |

## 2. 需求描述

### 背景
现有限制以固定字段散落于 `Team` / `RoleTemplate` / `ApiKey`，无法预设复用，且维度不全。本期落地策略数据模型：新增 `PolicySet`/`PolicyEntry`，实体通过 `policySetId` 引用挂载，并一次性硬迁移存量字段。

### 目标
- 新增 `PolicySet` schema：`tenantId + teamId`（`teamId=null` = 内置全局）、`name`、`description`、`entries: PolicyEntry[]`、`providerIds`、`modelWhitelist`、`builtIn`。
- `PolicyEntry = { measure, window, limit, action }`：
  - `measure ∈ token/request/concurrency/spend`
  - `window ∈ permanent/minute/hour/day/week/month`
  - `limit: number`（`0`/空 = 不限）
  - `action ∈ block/warn`
- 新增挂载字段：`Team.policySetId`、`RoleTemplate.policySetId`、`ApiKey.policySetId`（可选、`null` = 不限）。
- 删除旧限制字段（硬迁移）：
  - `Team`：`limitDaily/limitWeekly/limitMonthly`
  - `RoleTemplate`：`limitDaily/limitWeekly/limitMonthly/rateLimitPerMinute`
  - `ApiKey`：`limitDaily/limitWeekly/limitMonthly/rateLimitPerMinute/maxTokens`
  - 范围字段保留语义但迁入策略集：`providerIds`/`modelWhitelist`/`allowedModels`
- 新增 `policy-sets` 模块：CRUD API（`GET/POST/PATCH/DELETE /policy-sets`），DTO 校验（measure/window 枚举合法、`limit ≥ 0`、同 measure+window 去重提示）。
- 硬迁移脚本（幂等）：固定字段 → 等价策略条目 → 建/复用 PolicySet → 挂载 `policySetId` → 删除旧字段。

### 迁移映射表

| 旧字段 | 新策略条目 |
|---|---|
| `limitDaily` | `{ token, day, X, block }` |
| `limitWeekly` | `{ token, week, X, block }` |
| `limitMonthly` | `{ token, month, X, block }` |
| `rateLimitPerMinute` | `{ request, minute, X, block }` |
| `maxTokens` | `{ token, permanent, X, block }` |
| `providerIds` | PolicySet.`providerIds` |
| `modelWhitelist` / `allowedModels` | PolicySet.`modelWhitelist` |

### 验收条件
- [ ] `pnpm --filter portal-backend start:dev` 启动成功。
- [ ] Swagger 可调 `/policy-sets/*` CRUD，DTO 校验拒绝非法 measure/window/负 limit。
- [ ] 迁移脚本执行后：存量 `Team`/`RoleTemplate`/`ApiKey` 的限制字段已等价转为 `PolicySet` 并挂载，旧字段已删除；脚本重复执行不重复建策略（幂等）。
- [ ] 内置角色模板「设计师/开发人员」关联内置策略集（`builtIn=true`、`teamId=null`）。
- [ ] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过（含新增 policy-sets 单测）。

## 3. 技术方案摘要
- 复用 Nest.js + Mongoose 既有模式；`PolicySet`/`PolicyEntry` 参考 `docs/plan/BILLING_QUOTA_POLICY_PLAN.md` §3。
- `PolicyEntry` 可内嵌在 `PolicySet.entries`（子文档）或独立集合——首期采用内嵌子文档，减少 join。
- 迁移脚本置于 `apps/portal-backend/src/modules/policy-sets/migrations/`，通过 `OnApplicationBootstrap` 或独立脚本触发，幂等。
- 结构详见 `docs/plan/BILLING_QUOTA_POLICY_PLAN.md` §3 与 `docs/technical/db_schema/*` 更新。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/BILLING_QUOTA_REQ-006_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
