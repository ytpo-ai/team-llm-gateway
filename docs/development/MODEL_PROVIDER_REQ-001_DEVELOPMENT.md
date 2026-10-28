# MODEL_PROVIDER_REQ-001 开发记录（后端模型与上游管理）

> 对应需求：`docs/requirement/MODEL_PROVIDER_REQ-001_BACKEND_PROVIDER_MODEL.md`
> 对应计划：`docs/plan/MODEL_PROVIDER_PLAN.md`
> 分支：`main`

## 1. 实现摘要

在 API Key 之上落地「模型与上游」后端：新增 `Provider`（上游渠道）与 `Model`（模型目录）实体，上游 key AES-256-GCM 加密存储，为计量/计费/选型建议提供倍率与能力标签数据：

- 数据模型：`Provider`（tenantId+teamId+name+type+baseUrl+apiKeyCiphertext+apiKeyHint+status）、`Model`（tenantId+teamId+providerId+modelId+displayName+multiplier+capabilities+aliases+status）。
- 加密工具 `src/common/crypto/cipher.ts`：`aes-256-gcm`，密钥 = sha256(`ENCRYPTION_SECRET`)，密文 `iv.tag.ciphertext`（base64url）；`buildApiKeyHint` 生成脱敏前缀。
- `providers` 模块：`POST/GET/GET:id/PATCH/DELETE`，创建/更新时 apiKey 明文输入 → 密文落库，列表/详情仅返回 `apiKeyHint`，绝不返回明文/密文；删除为软禁用。
- `models` 模块：`POST/GET/GET:id/PATCH/DELETE`，创建/更新时校验 `providerId` 归属同团队；`multiplier` 默认 1，`capabilities`/`aliases` 数组；删除为软禁用。
- RBAC：`providers` 全部 `team_admin`（类级 `@Roles(TEAM_ADMIN)`）；`models` 读所有成员、写 `team_admin`。
- 租户/团队隔离：所有查询按 `tenantId + teamId` 过滤。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `common/crypto/cipher.ts` | AES-256-GCM 加解密 + key 脱敏 hint |
| `modules/providers/schemas/provider.schema.ts` | `Provider` 实体 + `ProviderType`/`ProviderStatus` |
| `modules/providers/dto/create-provider.dto.ts` | 创建入参（name/type/baseUrl/apiKey） |
| `modules/providers/dto/update-provider.dto.ts` | 更新入参（全部可选，apiKey 可选重设） |
| `modules/providers/providers.service.ts` | 加密落库、CRUD、重名校验、软禁用、脱敏视图 |
| `modules/providers/providers.controller.ts` | `/providers` REST 接口（team_admin） |
| `modules/providers/providers.module.ts` | 模块装配 |
| `modules/providers/providers.service.spec.ts` | 单测（7 例） |
| `modules/models/schemas/model.schema.ts` | `Model` 实体 + `ModelStatus` |
| `modules/models/dto/create-model.dto.ts` | 创建入参 |
| `modules/models/dto/update-model.dto.ts` | 更新入参 |
| `modules/models/models.service.ts` | 渠道归属校验、CRUD、软禁用 |
| `modules/models/models.controller.ts` | `/models` REST 接口（读所有成员，写 team_admin） |
| `modules/models/models.module.ts` | 模块装配 |
| `modules/models/models.service.spec.ts` | 单测（5 例） |

### 修改

| 文件 | 说明 |
|---|---|
| `config/configuration.ts` | 新增 `encryption.secret`（`ENCRYPTION_SECRET`） |
| `app.module.ts` | 注册 `ProvidersModule`、`ModelsModule` |
| `.env.example` | 新增 `ENCRYPTION_SECRET` |

## 3. 踩坑记录

1. **单测 ConfigService 注入 token**：`ProvidersService` 注入 `ConfigService`，测试需 `{ provide: ConfigService, useValue: mock }` 用类作 token，而非字符串 `'ConfigService'`，否则 Nest 报「can't resolve dependencies」。
2. **ObjectId 字段赋值**：`Model.providerId` 为 `Types.ObjectId`，更新时需 `new Types.ObjectId(dto.providerId)` 赋值，直接赋 string 会触发 strict 类型错误。

## 4. 验证结果

- `pnpm --filter portal-backend lint`：0 errors / 0 warnings。
- `pnpm --filter portal-backend typecheck`：通过。
- `pnpm --filter portal-backend build`：通过。
- `pnpm --filter portal-backend test`：38 passed（auth 9 + teams 9 + api-keys 7 + providers 7 + models 5 + app 1）。

## 5. 关联

- feature：`docs/feature/model_provider.md`
- 数据模型：`docs/technical/db_schema/MODEL_PROVIDER_SCHEMA.MD`
- 待决事项：M-01（转发层）、M-02（Anthropic 翻译）、M-03（探活）、M-04（密钥管理）、M-05（归属粒度）见 `docs/plan/MODEL_PROVIDER_PLAN.md` §7。
