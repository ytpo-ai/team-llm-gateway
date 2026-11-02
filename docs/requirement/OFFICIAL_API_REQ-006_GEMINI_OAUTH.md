# OFFICIAL_API_REQ-006 Gemini OAuth 服务账号认证

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/model_provider.md` |
| 所属 plan | `docs/plan/OFFICIAL_API_ADVANCED_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/official-api-gemini-oauth` |
| 状态 | `done` |

## 2. 需求描述

### 背景
`GeminiAdapter`（`OFFICIAL_API_REQ-003`）仅支持 `x-goog-api-key` 认证（`OFFICIAL_API_PLAN` §6 O-02）。现补齐服务账号 OAuth 认证，满足企业场景下的短期令牌需求。

### 目标
- `Provider` 新增可选 `authType` 字段（`'api-key'` | `'oauth'`，默认 `'api-key'`），schema + DTO + 前端表单同步。
- `oauth` 模式下：`Provider.apiKey` 字段存服务账号 JSON（仍 AES-256-GCM 加密、脱敏展示不变），`GeminiAdapter` 解析 `client_email`/`private_key`/`token_uri`。
- Token 交换：用 `node:crypto` 的 `crypto.sign`（RS256）签 JWT → POST `token_uri` 换取 `access_token`，内存缓存（约 1 小时，提前刷新）。
- 请求认证：`Authorization: Bearer <access_token>` 替代 `x-goog-api-key`。
- 接口调整：`UpstreamAdapter.buildRequest` 由同步改为 `Promise<AdapterRequest>`，波及 `ProxyService.prepare()` 与 `ProvidersService.test()`（均为 async 上下文，改动收敛）。

### 验收条件
- [ ] `authType=oauth` 的 Gemini 渠道能以 `Authorization: Bearer` 成功调用 `generateContent`。
- [ ] access_token 换取成功且命中内存缓存（相同服务账号不重复换 token）。
- [ ] `authType=api-key` 行为不回归（仍走 `x-goog-api-key`）。
- [ ] 服务账号私钥仍加密落库，列表/详情仅脱敏 hint。
- [ ] 单测覆盖：JWT 签名、token 交换（mock fetch）、缓存命中、buildRequest async 改造回归；`lint`/`typecheck`/`test` 通过。

## 3. 技术方案摘要
- 方案与接口调整见 `docs/plan/OFFICIAL_API_ADVANCED_PLAN.md` §3。
- OAuth 细节（token_uri、scope）见 A-02；scope 使用 `https://www.googleapis.com/auth/generativelanguage`。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/OFFICIAL_API_REQ-006_DEVELOPMENT.md`（待补充） |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
