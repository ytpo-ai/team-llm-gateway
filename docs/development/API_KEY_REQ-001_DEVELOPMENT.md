# API_KEY_REQ-001 开发记录（后端 API Key 管理）

> 对应需求：`docs/requirement/API_KEY_REQ-001_BACKEND_KEY.md`
> 对应计划：`docs/plan/API_KEY_PLAN.md`
> 分支：`feat/api-key-backend`（提交 `78bdef5`）

## 1. 实现摘要

在团队与成员之上落地 `ApiKey` 实体与 key 签发/吊销/轮换，复用 `team_member` 已交付的鉴权与租户隔离约定：

- 数据模型：新增 `ApiKey`（`tenantId → teamId → userId` 三级归属 + `keyHash`/`keyPrefix` + `status` + 细粒度限制 `expiresAt`/`allowedModels`/`rateLimitPerMinute`/`maxTokens` + `lastUsedAt` 预留）。
- key 生成：`pk_` + `randomBytes(24).base64url`；落库仅 sha256 哈希（`keyHash` 唯一索引）+ 前缀 `keyPrefix`（前 12 字符），明文 key 绝不落库。
- `api-keys` 模块：`POST /api-keys`（创建，完整 key 仅返回一次）、`GET /api-keys`（列表）、`GET /api-keys/:id`、`PATCH /api-keys/:id`（更新限制）、`DELETE /api-keys/:id`（吊销，软删除）、`POST /api-keys/:id/rotate`（轮换：新建 + 吊销旧 key）。
- RBAC：普通成员仅能操作自己的 key；`team_admin` 可查看/吊销全团队 key（`findAccessibleKey` 统一判定 owner / team_admin）。
- 列表/详情返回脱敏视图 `ApiKeyView`（仅 `keyPrefix`，不含完整值）。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `modules/api-keys/schemas/api-key.schema.ts` | `ApiKey` 实体 + `ApiKeyStatus` |
| `modules/api-keys/dto/create-api-key.dto.ts` | 创建入参（name/expiresAt/allowedModels/rateLimitPerMinute/maxTokens） |
| `modules/api-keys/dto/update-api-key.dto.ts` | 更新入参（全部可选，支持置 null 清除限制） |
| `modules/api-keys/api-keys.service.ts` | key 生成（sha256 + 前缀）、CRUD/轮换、RBAC 判定、脱敏视图 |
| `modules/api-keys/api-keys.controller.ts` | `/api-keys` 及子资源 REST 接口 |
| `modules/api-keys/api-keys.module.ts` | 模块装配（Mongoose forFeature） |
| `modules/api-keys/api-keys.service.spec.ts` | 单测（7 例） |

### 修改

| 文件 | 说明 |
|---|---|
| `app.module.ts` | 注册 `ApiKeysModule` |

## 3. 踩坑记录

1. **未使用的 Swagger 装饰器 import**：`create-api-key.dto.ts` 初始导入了 `ApiProperty` 但只用到 `ApiPropertyOptional`，触发 oxlint `no-unused-vars` 警告。已移除多余 import。
2. **限制字段的「清除」语义**：`UpdateApiKeyDto` 需区分「未传」（保持原值）与「传 null」（清除限制）。用 `@IsOptional()` 使 null/undefined 均跳过校验，服务层以 `dto.x !== undefined` 判定是否写入、`?? null` 处理清除，`expiresAt` 用 `dto.expiresAt ? new Date(...) : null` 兼容空串。

## 4. 验证结果

- `pnpm --filter portal-backend lint`：0 errors / 0 warnings。
- `pnpm --filter portal-backend typecheck`：通过。
- `pnpm --filter portal-backend test`：26 passed（auth 9 + teams 9 + api-keys 7 + app 1）。
- 单测覆盖：创建（哈希落库、明文不落库、前缀 ≠ 完整值）、列表（member 只看自己 / team_admin 看团队）、get（越权 403 / 不存在 404）、吊销（软删除）、轮换（旧 key 吊销 + 新 key 生成）。

## 5. 关联

- feature：`docs/feature/api_key.md`
- 数据模型：`docs/technical/db_schema/API_KEY_SCHEMA.MD`
- 待决事项：A-01（成本维度预算）、A-02（限制强制执行点）、A-03（lastUsedAt 更新来源）、A-04（前缀兼容性）见 `docs/plan/API_KEY_PLAN.md` §7。
