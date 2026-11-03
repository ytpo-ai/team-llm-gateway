# API_KEY_REQ-001 后端 API Key 管理

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/api_key.md` |
| 所属 plan | `docs/plan/API_KEY_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/api-key-backend` |
| 状态 | `done` |

## 2. 需求描述

### 背景
`team_member` 已交付 Team/User/RBAC。现落地 API Key 管理后端：新增 `ApiKey` 实体、key 签发/吊销/轮换、哈希+前缀存储、每 key 细粒度限制字段，复用现有鉴权与租户隔离约定。

### 目标
- 新增 `ApiKey` 数据模型（详见 `docs/technical/db_schema/API_KEY_SCHEMA.MD`）。
- `api-keys` 模块：创建（返回完整 key 一次）、列表、详情、更新限制、吊销、轮换。
- key 哈希存储：`keyHash`（sha256 唯一）+ `keyPrefix`（展示前缀），明文 key 绝不落库。
- 细粒度限制字段：`allowedModels` / `rateLimitPerMinute` / `maxTokens` / `expiresAt`。
- RBAC：普通成员仅能操作自己的 key；`team_admin` 可查看/吊销全团队 key。
- 租户隔离：所有查询按 `tenantId` 过滤。

### 验收条件
- [x] `pnpm --filter portal-backend start:dev` 启动成功。
- [x] Swagger 可调 `POST /api-keys`、`GET /api-keys`、`GET /api-keys/:id`、`PATCH /api-keys/:id`、`DELETE /api-keys/:id`、`POST /api-keys/:id/rotate`。
- [x] 创建返回完整 key 一次；列表/详情仅返回 `keyPrefix`，不泄露明文。
- [x] Mongo 落库仅存 `keyHash`，无明文 key。
- [x] 成员只能操作自己的 key；`team_admin` 可看全团队 key。
- [x] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过。

## 3. 技术方案摘要
- 复用 Nest.js + Mongoose + class-validator + Swagger 既有模式（参考 `apps/portal-backend/src/modules/teams/`、`auth/`）。
- 数据模型与生成规则见 `docs/technical/db_schema/API_KEY_SCHEMA.MD`、`docs/plan/API_KEY_PLAN.md` §3/§4。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/API_KEY_REQ-001_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
