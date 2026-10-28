# MODEL_PROVIDER_REQ-001 后端模型与上游管理

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/model_provider.md` |
| 所属 plan | `docs/plan/MODEL_PROVIDER_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/model-provider-backend` |
| 状态 | `done` |

## 2. 需求描述

### 背景
`api_key` 已交付，但其 `allowedModels` 为自由文本，无模型目录支撑；计量/计费/选型建议都依赖模型倍率与能力标签。现落地「模型与上游」后端：新增 `Provider`、`Model` 实体与 `providers`/`models` 模块，上游 key 加密存储。

### 目标
- 新增 `Provider`、`Model` 数据模型（详见 `docs/technical/db_schema/MODEL_PROVIDER_SCHEMA.MD`）。
- 新增 AES-256-GCM 加解密工具（`src/common/crypto/cipher.ts`），密钥取自配置 `encryption.secret`（`ENCRYPTION_SECRET`）。
- `providers` 模块：创建（apiKey 明文输入 → 密文落库）、列表/详情（仅脱敏 hint）、更新（可选更新 apiKey）、删除（软禁用）。
- `models` 模块：创建/列表/详情/更新/删除（软禁用）；创建时校验 `providerId` 归属同团队。
- RBAC：`providers` 全部 `team_admin`；`models` 读所有成员、写 `team_admin`。
- 租户/团队隔离：所有查询按 `tenantId + teamId` 过滤。

### 验收条件
- [ ] `pnpm --filter portal-backend start:dev` 启动成功。
- [ ] Swagger 可调 `POST/GET/GET:id/PATCH/DELETE /providers` 与 `POST/GET/GET:id/PATCH/DELETE /models`。
- [ ] 上游 key 仅密文落库，列表/详情仅返回 `apiKeyHint`，不返回明文/密文。
- [ ] 成员可读模型目录，但不可写渠道/模型；`team_admin` 可全量读写。
- [ ] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过。

## 3. 技术方案摘要
- 复用 Nest.js + Mongoose + class-validator + Swagger 既有模式（参考 `apps/portal-backend/src/modules/api-keys/`、`teams/`）。
- 数据模型与加密规则见 `docs/technical/db_schema/MODEL_PROVIDER_SCHEMA.MD`、`docs/plan/MODEL_PROVIDER_PLAN.md` §3/§4。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/MODEL_PROVIDER_REQ-001_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
