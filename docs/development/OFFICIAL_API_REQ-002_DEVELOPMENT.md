# OFFICIAL_API_REQ-002 开发记录（Anthropic Messages 协议翻译）

> 对应需求：`docs/requirement/OFFICIAL_API_REQ-002_ANTHROPIC.md`
> 对应计划：`docs/plan/OFFICIAL_API_PLAN.md`
> 分支：`main`

## 1. 实现摘要

实现 `AnthropicAdapter`：OpenAI Chat Completions ↔ Anthropic Messages API 的请求/响应/流式/usage/认证完整翻译，闭环 `MODEL_PROVIDER_PLAN` M-02。

- 请求：`system` 消息拆为顶层 `system`；角色 `tool→user`；`max_tokens` 必填（无则默认 4096，或取 `max_completion_tokens`）；透传 `temperature/top_p`，`stop→stop_sequences`。
- 认证：`x-api-key` + `anthropic-version: 2023-06-01`。
- 端点：`${baseUrl}/v1/messages`。
- 响应：`content[].text` → `choices[].message.content`；`usage.input_tokens/output_tokens` → usage。
- 流式：`message_start`/`content_block_delta`/`message_delta`/`message_stop` → OpenAI `chat.completion.chunk`；usage 从 `message_delta` 提取。

## 2. 代码改动点

| 文件 | 说明 |
|---|---|
| `modules/proxy/adapters/anthropic.adapter.ts` | `AnthropicAdapter` + `AnthropicStreamTransformer` |
| `modules/proxy/adapters/anthropic.adapter.spec.ts` | 单测（5 例：类型/请求/响应/流式） |

## 3. 踩坑记录

1. `message_start` 的 `usage.input_tokens` 与 `message_delta` 的 `usage.output_tokens` 分属不同事件，需在 transformer 内跨事件累积 input/output token，`message_delta` 时才合成完整 usage 并随 finish chunk 下发。

## 4. 验证结果

- 后端 lint/typecheck/build/test 全部通过（112 passed，含 anthropic 5 例）。

## 5. 关联

- feature：`docs/feature/model_provider.md`
- 计划：`docs/plan/OFFICIAL_API_PLAN.md`
- 待决：O-01（工具调用/vision 内容块翻译后置）
