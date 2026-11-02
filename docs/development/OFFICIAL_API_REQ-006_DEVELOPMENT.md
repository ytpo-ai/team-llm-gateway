# OFFICIAL_API_REQ-006 开发记录（Gemini OAuth 服务账号认证）

> 对应需求：`docs/requirement/OFFICIAL_API_REQ-006_GEMINI_OAUTH.md`
> 对应计划：`docs/plan/OFFICIAL_API_ADVANCED_PLAN.md`
> 分支：`main`

## 1. 实现摘要

在 `GeminiAdapter` 上补齐服务账号 OAuth 认证（闭环 O-02），并因此将 `UpstreamAdapter.buildRequest` 由同步改为异步。

- `Provider` 新增 `authType`（`api-key`/`oauth`，默认 `api-key`），schema/DTO/前端表单同步；`oauth` 下 `apiKey` 字段存服务账号 JSON（仍 AES-256-GCM 加密）。
- 新增 `gemini-oauth.ts`：`crypto.sign`(RS256) 签 JWT → POST `token_uri` 换 access_token，内存缓存（约 1 小时，提前 60s 刷新）。
- `GeminiAdapter.buildRequest`：`authType=oauth` 时用 `Authorization: Bearer`，否则 `x-goog-api-key`。
- 接口调整：`buildRequest` → `Promise<AdapterRequest>`，`ProxyService.prepare()` 与 `ProvidersService.test()` 同步改为 `await`。

## 2. 代码改动点

### 后端

| 文件 | 说明 |
|---|---|
| `modules/providers/schemas/provider.schema.ts` | 新增 `ProviderAuthType` + `authType` 字段 |
| `modules/providers/dto/create-provider.dto.ts` / `update-provider.dto.ts` | 新增 `authType` |
| `modules/providers/providers.service.ts` | create/update 处理 authType，视图返回 authType |
| `modules/proxy/adapters/upstream-adapter.ts` | `buildRequest` 改 async，`BuildRequestInput` 增 `authType` |
| `modules/proxy/adapters/openai-compatible.adapter.ts` / `anthropic.adapter.ts` | `buildRequest` 改 async |
| `modules/proxy/adapters/gemini.adapter.ts` | async `buildRequest` + OAuth 分支 |
| `modules/proxy/adapters/gemini-oauth.ts` | JWT 签名 + token 交换 + 内存缓存 |
| `modules/proxy/proxy.service.ts` | `await adapter.buildRequest` + 传 authType |
| `modules/providers/providers.service.ts` | `await adapter.buildRequest` + 传 authType |
| `modules/proxy/adapters/gemini.adapter.spec.ts` | 新增 OAuth 用例（真实 RSA key 签名） |

### 前端

| 文件 | 说明 |
|---|---|
| `features/providers/types.ts` | 新增 `ProviderAuthType` + `authType` 字段与标签 |
| `pages/providers.tsx` | Gemini 类型下可选认证方式；oauth 用 textarea 贴服务账号 JSON |

## 3. 踩坑记录

1. **测试需真实 RSA 私钥**：`crypto.sign('RSA-SHA256')` 对假 PEM 会抛错，测试用 `generateKeyPairSync('rsa', 2048)` 现场生成私钥。
2. **token 缓存键**：以 `client_email` 为键缓存 access_token，避免不同服务账号互相污染。

## 4. 验证结果

- 后端：lint 0/0、typecheck 通过、build 通过、test 118 passed（含 gemini 6 例）。
- 前端：typecheck/build 通过，lint 3 警告均为既有。

## 5. 关联

- feature：`docs/feature/model_provider.md`
- 计划：`docs/plan/OFFICIAL_API_ADVANCED_PLAN.md`
- 待决：A-02（多实例部署 token 缓存引 Redis 后置）
