# ANTHROPIC_OUTWARD_REQ-001 开发记录（后端：对外 Anthropic Messages 端点）

> 对应需求：`docs/requirement/ANTHROPIC_OUTWARD_REQ-001_MESSAGES_ENDPOINT.md`
> 对应计划：`docs/plan/ANTHROPIC_OUTWARD_PLAN.md`
> 分支：`feat/official-channel-dual-format`

## 1. 实现摘要

Portal 对外转发层新增 Anthropic Messages 兼容端点，使 Claude Code / Anthropic SDK 可直接接入团队网关。

- 新增 `POST /v1/messages`（非流式 + SSE 流式），请求/响应均为 Anthropic Messages 格式。
- 请求翻译 `anthropicToOpenAI()`：Anthropic Messages（system / messages 内容块 / tools / tool_choice / stop_sequences / max_tokens）→ OpenAI Chat body。
- 响应翻译 `openAIToAnthropic()`：OpenAI Chat → Anthropic Messages（content 块 / stop_reason / usage）。
- 流式翻译 `OpenAIAnthropicStreamTransformer`：上游 OpenAI SSE → Anthropic SSE（message_start / content_block_start / content_block_delta / content_block_stop / message_delta / message_stop）。
- 复用 `ProxyService.prepare` + `requestUpstream` + `recordUsage`，仅在外层做协议翻译；`prepare` 内部的上游适配器（openai-compatible/anthropic/gemini）对「外向协议」透明。
- `ApiKeyAuthGuard` 兼容 `x-api-key` 头（Anthropic）与 `Authorization: Bearer`（OpenAI）。

## 2. 代码改动点

### 后端

| 文件 | 说明 |
|---|---|
| `modules/proxy/adapters/anthropic-protocol.ts` | 新增：`anthropicToOpenAI` / `openAIToAnthropic` / `OpenAIAnthropicStreamTransformer` / `anthropicError` |
| `modules/proxy/proxy.service.ts` | 新增 `messages` / `streamMessages`，复用 `prepare` / `requestUpstream` / `recordUsage` / `recordError` |
| `modules/proxy/proxy.controller.ts` | 新增 `POST /v1/messages`（非流式 + SSE） |
| `modules/proxy/guards/api-key-auth.guard.ts` | 鉴权兼容 `x-api-key`（Anthropic）与 `Authorization: Bearer`（OpenAI） |
| `modules/proxy/adapters/anthropic-protocol.spec.ts` | 新增单测（11 例） |

## 3. 踩坑记录

1. **鉴权差异**：Anthropic 客户端用 `x-api-key` 头（非 `Authorization: Bearer`），guard 需双头兼容，否则 Claude Code 直接 401。
2. **流式双级翻译**：上游适配器 `createStreamTransformer` 统一输出 OpenAI SSE，`streamMessages` 再套一层 OpenAI→Anthropic 翻译（`openaiTransformer.push` → `anthropicTransformer.push`）；usage 从 OpenAI 侧 `getUsage()` 取，Anthropic 侧只负责事件重排。
3. **OpenAI 空值**：OpenAI `delta.content` 可能为 `null`（纯 tool_calls 块），翻译时按 `typeof === 'string'` 判定，跳过 null。
4. **结束兜底**：`finish()` 在未收到 `finish_reason` 时兜底补 `content_block_stop` + `message_stop`，避免客户端挂起。

## 4. 验证结果

- 后端：typecheck 通过、lint 0/0、test 184 passed（含 anthropic-protocol 11 例）。

## 5. 关联

- feature：`docs/feature/model_provider.md`
- 计划：`docs/plan/ANTHROPIC_OUTWARD_PLAN.md`
