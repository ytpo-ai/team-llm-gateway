# OFFICIAL_API_REQ-003 Google Gemini 协议翻译

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/model_provider.md` |
| 所属 plan | `docs/plan/OFFICIAL_API_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/official-api-gemini` |
| 状态 | `done` |

## 2. 需求描述

### 背景
Gemini 官方协议（generateContent/streamGenerateContent）与 OpenAI 不兼容。现实现 Gemini 的完整协议翻译，使团队可直连 Google Gemini 官方。

### 目标
- 新增 `GeminiAdapter`（实现 `UpstreamAdapter`）：
  - **请求翻译**：OpenAI messages → `contents[].parts[].text`（系统提示词拆为顶层 `systemInstruction`）；参数 → `generationConfig`（`maxOutputTokens`/`temperature` 等）。
  - **认证**：`x-goog-api-key: <key>` + `content-type: application/json`。
  - **端点**：`${baseUrl}/v1beta/models/{modelId}:generateContent`（非流式）与 `:streamGenerateContent`（流式）。
  - **响应翻译（非流式）**：`candidates[].content.parts[].text` → `choices[].message.content`；`usageMetadata.promptTokenCount/candidatesTokenCount/totalTokenCount` → usage。
  - **流式翻译**：`streamGenerateContent` 数组块 → OpenAI `chat.completion.chunk` 事件；usage 从 `usageMetadata` 提取。
  - **错误归一**：`error.code`/`error.message` → 相应 HTTP 状态。
- 计量联动：usage 提取后统一走既有 `UsageService.record()` + `BillingService.deduct()`。

### 验收条件
- [x] `type=gemini` 渠道：`POST /v1/chat/completions` 可正确翻译并转发到 `:generateContent` / `:streamGenerateContent`。
- [x] 非流式与流式响应均映射为 OpenAI 格式，成员 key 侧无感知。
- [x] usage（`usageMetadata`）正确落库 `UsageLog` 并触发扣费。
- [x] 单测覆盖：请求翻译、响应翻译、流式事件映射、usage 提取、错误归一（固定 fixture）。
- [x] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过。

## 3. 技术方案摘要
- 翻译要点与参数映射见 `docs/plan/OFFICIAL_API_PLAN.md` §3.1。
- 首期仅 `x-goog-api-key` 认证；OAuth 服务账号后置（O-02）。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/OFFICIAL_API_REQ-003_DEVELOPMENT.md`（待补充） |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
