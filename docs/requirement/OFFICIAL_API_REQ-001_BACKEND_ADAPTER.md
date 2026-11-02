# OFFICIAL_API_REQ-001 后端协议适配层

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/model_provider.md` |
| 所属 plan | `docs/plan/OFFICIAL_API_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/official-api-adapter` |
| 状态 | `done` |

## 2. 需求描述

### 背景
转发层（`proxy.service.ts`）当前为纯 OpenAI 格式直通，`ProviderType` 仅 `openai-compatible`（默认）与 `anthropic`（保留但拒绝）。现搭建**上游适配器抽象**作为协议翻译层的骨架，并将现有直通逻辑重构为「OpenAI 兼容基线适配器」，保证行为不回归。

### 目标
- 扩展 `ProviderType`：新增 `GEMINI = 'gemini'`（`anthropic` 已存在），`openai-compatible` 保持默认。
- 新增 `UpstreamAdapter` 接口与工厂路由（按 `provider.type` 返回适配器）：
  - `type: ProviderType`
  - `buildRequest(baseUrl, apiKey, modelId, body)` → `{ url, headers, body }`
  - `parseResponse(text)` → OpenAI 格式响应（非流式）
  - `extractUsage(sseBuffer)` → `Usage | undefined`（流式）
  - `mapError(status, body)` → 归一错误（HTTP 状态 + 信息）
- 新增 `OpenAICompatibleAdapter`：将现有 `prepare()`/`requestUpstream()`/`extractUsage()` 的 OpenAI 直通逻辑迁入，行为与现状完全一致。
- 改造 `ProxyService`：`prepare()` 由「拼 URL + 固定 Bearer」改为「路由到适配器生成请求」，流式/非流式/计量联动逻辑不变。
- 目录结构：`apps/portal-backend/src/modules/proxy/adapters/`（接口 + 工厂 + `openai-compatible.adapter.ts`）。

### 验收条件
- [x] `ProviderType` 含 `openai-compatible` / `anthropic` / `gemini`。
- [x] `type=openai-compatible` 渠道的转发、SSE 流式、usage 提取、计量与改造前行为一致（回归通过）。
- [x] `type=anthropic` / `type=gemini` 路由到对应适配器（首期可为占位，REQ-002/003 实现）。
- [x] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过。

## 3. 技术方案摘要
- 适配器接口与工厂设计见 `docs/plan/OFFICIAL_API_PLAN.md` §3。
- 复用既有 `UsageService.record()` / `BillingService.deduct()` / `RateLimitService`，不改计量口径。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/OFFICIAL_API_REQ-001_DEVELOPMENT.md`（待补充） |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
