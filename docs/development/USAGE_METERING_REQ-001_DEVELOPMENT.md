# USAGE_METERING_REQ-001 开发记录（后端计量与用量）

> 对应需求：`docs/requirement/USAGE_METERING_REQ-001_BACKEND_METERING.md`
> 对应计划：`docs/plan/USAGE_METERING_PLAN.md`
> 分支：`main`

## 1. 实现摘要

落地「计量与用量」后端：`UsageLog` 用量流水 + 计量服务（`record()` 上报 + 三级聚合查询）+ `/usage/*` 查询 API，为转发层（REQ-002）与前端看板（REQ-003）提供基础。

- 数据模型：`UsageLog`（tenantId/teamId/userId/apiKeyId 四级归属 + providerId/modelId/requestId + prompt/completion/total token + multiplier 快照 + cost + status + latencyMs/scenario）。
- `UsageService.record(input)`：进程内上报，ObjectId 字段转换后落库（不重算 cost，快照一致性）。
- 聚合查询（MongoDB aggregation pipeline）：`summary`（`$group` 汇总）、`trends`（`$dateTrunc` 时间桶，粒度 hour/day）、`by-model`/`by-member`/`by-key`（`$group` + `$sort` + `$limit`）；`by-member`/`by-key` 用 `User`/`ApiKey` 补全展示 label。
- RBAC：`member` 仅本人（match 追加 `userId`），`team_admin`/`finance`/`viewer` 团队全量。
- 查询 API：`GET /usage/summary`、`/usage/trends`、`/usage/by-model`、`/usage/by-member`、`/usage/by-key`，`from`/`to`（默认近 30 天）+ `granularity`。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `modules/usage/schemas/usage-log.schema.ts` | `UsageLog` 实体 + `UsageStatus` + 时间序列/归属索引 |
| `modules/usage/dto/usage-query.dto.ts` | `UsageQueryDto`（from/to/granularity）+ `UsageGranularity` |
| `modules/usage/usage.service.ts` | record + 聚合查询 + RBAC scope + label 补全 |
| `modules/usage/usage.controller.ts` | `/usage/*` REST 接口（JWT 鉴权，所有成员可读） |
| `modules/usage/usage.module.ts` | 模块装配（forFeature UsageLog/User/ApiKey） |
| `modules/usage/usage.service.spec.ts` | 单测（5 例：record/summary scope/trends/byMember 补全） |

### 修改

| 文件 | 说明 |
|---|---|
| `app.module.ts` | 注册 `UsageModule` |

## 3. 踩坑记录

1. **`$dateTrunc` 时间桶**：趋势按 `hour`/`day` 聚合用 `$dateTrunc`（MongoDB 5.0+），`unit` 直接复用 `UsageGranularity` 枚举值（`hour`/`day`），避免手写 `$dateToString` 格式串。
2. **RBAC 过滤进 `$match`**：`member` 限制通过在 `$match` 阶段追加 `userId` 实现，聚合在匹配范围内进行，而非聚合后再过滤（保证趋势/汇总口径一致）。
3. **label 补全二次查询**：`by-member`/`by-key` 聚合得到 id 后，再 `find({ _id: { $in } })` 取 name/keyPrefix 建 `Map` 补全，避免在聚合里做 `$lookup` 增加复杂度。

## 4. 验证结果

- `pnpm --filter portal-backend lint`：0 errors / 0 warnings。
- `pnpm --filter portal-backend typecheck`：通过。
- `pnpm --filter portal-backend build`：通过。
- `pnpm --filter portal-backend test`：48 passed（新增 usage 5）。

## 5. 关联

- feature：`docs/feature/usage_metering.md`
- 数据模型：`docs/technical/db_schema/USAGE_METERING_SCHEMA.MD`
- 上游：`docs/plan/USAGE_METERING_PLAN.md` §3/§4
