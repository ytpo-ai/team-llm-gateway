# OFFICIAL_API_REQ-002 Anthropic Messages 协议翻译

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/model_provider.md` |
| 所属 plan | `docs/plan/OFFICIAL_API_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/official-api-anthropic` |
| 状态 | `done` |

## 2. 需求描述

### 背景
`model_provider` 已预留 `ProviderType.ANTHROPIC`，`proxy.service.ts` 直接拒绝该类型（M-02 后置）。现实现 Anthropic Messages API 的完整协议翻译，使团队可直连 Claude 官方。

### 目标
- 新增 `AnthropicAdapter`（实现 `UpstreamAdapter`）：
  - **请求翻译**：OpenAI messages → Anthropic messages（`system` 拆出为顶层 `system`；角色映射 `tool→user`）；`max_tokens` 必填（OpenAI 无 `max_tokens`/`max_completion_tokens` 时设默认值）；仅透传 `temperature`/`top_p` 等 Anthropic 支持参数。
  - **认证**：`x-api-key: <key>` + `anthropic-version: 2023-06-01` + `content-type: application/json`。
  - **端点**：`${baseUrl}/v1/messages`。
  - **响应翻译（非流式）**：`content[].text` → `choices[].message.content`；`usage.input_tokens/output_tokens` → `prompt_tokens/completion_tokens/total_tokens`。
  - **流式翻译**：Anthropic SSE（`message_start` / `content_block_delta` / `message_delta` / `message_stop`）→ OpenAI `chat.completion.chunk` 事件；usage 从 `message_delta.usage` 提取。
  - **错误归一**：`error.type`/`error.message` → 相应 HTTP 状态。
- 计量联动：usage 提取后统一走既有 `UsageService.record()` + `BillingService.deduct()`。

### 验收条件
- [x] `type=anthropic` 渠道：`POST /v1/chat/completions` 可正确翻译并转发到 `/v1/messages`。
- [x] 非流式与流式（SSE）响应均映射为 OpenAI 格式，成员 key 侧无感知。
- [x] usage（`input_tokens`/`output_tokens`）正确落库 `UsageLog` 并触发扣费。
- [x] 单测覆盖：请求翻译、响应翻译、流式事件映射、usage 提取、错误归一（固定 fixture）。
- [x] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过。

## 3. 技术方案摘要
- 翻译要点与参数映射见 `docs/plan/OFFICIAL_API_PLAN.md` §3.1。
- 首期仅纯文本消息；工具调用（`tool_use`/`tool_result`）与 vision 内容块翻译后置（O-01）。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/OFFICIAL_API_REQ-002_DEVELOPMENT.md`（待补充） |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
