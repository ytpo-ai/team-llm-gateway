# USAGE_METERING_REQ-001 后端计量与用量

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/usage_metering.md` |
| 所属 plan | `docs/plan/USAGE_METERING_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/usage-metering-backend` |
| 状态 | `done` |

## 2. 需求描述

### 背景
`model_provider` 已交付模型目录（倍率 + 能力标签）与上游渠道。现落地「计量与用量」后端：`UsageLog` 用量流水 + 计量服务 + 三级聚合查询 API，为转发层（REQ-002）与前端看板（REQ-003）提供基础。

### 目标
- 新增 `UsageLog` 数据模型（详见 `docs/technical/db_schema/USAGE_METERING_SCHEMA.MD`）。
- 新增 `usage` 模块：`UsageService`（`record()` 上报 + 聚合查询）+ `UsageController`（查询 API）。
- 查询 API：`GET /usage/summary`、`/usage/trends`、`/usage/by-model`、`/usage/by-member`、`/usage/by-key`，支持 `from`/`to` 时间区间与 `granularity`（`hour`/`day`）粒度。
- RBAC：`member` 仅返回本人用量；`team_admin`/`finance`/`viewer` 返回团队全量。
- 租户/团队隔离：所有查询按 `tenantId + teamId`（成员再叠加 `userId`）过滤。

### 验收条件
- [x] `pnpm --filter portal-backend start:dev` 启动成功。
- [x] Swagger 可调 `/usage/*` 各查询接口，聚合结果正确（token/cost/次数）。
- [x] `member` 看不到他人用量；`team_admin` 可看团队全量。
- [x] `UsageService.record()` 落库正确，供 REQ-002 转发层调用。
- [x] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过。

## 3. 技术方案摘要
- 复用 Nest.js + Mongoose + Swagger 既有模式（参考 `apps/portal-backend/src/modules/models/`、`api-keys/`）。
- 聚合用 MongoDB aggregation pipeline（`$match` + `$group` + `$sort`），不引时序库。
- 数据模型与上报契约见 `docs/technical/db_schema/USAGE_METERING_SCHEMA.MD`、`docs/plan/USAGE_METERING_PLAN.md` §3/§4。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/USAGE_METERING_REQ-001_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
