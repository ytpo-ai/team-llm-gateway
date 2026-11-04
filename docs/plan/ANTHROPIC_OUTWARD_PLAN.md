# 对外 Anthropic 兼容端点开发计划（ANTHROPIC_OUTWARD）

> Portal 对外 API 增加 Anthropic Messages 兼容端点，使 Claude Code / Anthropic SDK 等客户端可直接接入团队网关。
>
> - 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-13、§5.2）
> - 上游参考：`docs/plan/OFFICIAL_API_PLAN.md`（REQ-002 Anthropic 翻译，本 plan 复用其映射、方向相反）
> - 定稿时间：2026-11-04
> - 状态：`in-progress`

---

## 1. 需求背景

当前转发层仅暴露 OpenAI 兼容端点（`GET /v1/models`、`POST /v1/chat/completions`）。Claude Code / Anthropic SDK 走 Anthropic Messages 协议（`POST /v1/messages`，鉴权用 `x-api-key` 头），无法直接接入。现补齐 Anthropic 兼容端点，实现「一套转发内核、两种对外协议」。

## 2. 目标

1. 新增 `POST /v1/messages`（非流式 + SSE 流式），请求/响应均为 Anthropic Messages 格式。
2. 复用现有 `ProxyService.prepare`（模型解析 / 鉴权 / 限流 / 余额预检 / 上游适配器），仅在外层做协议翻译。
3. 鉴权 guard 兼容 `x-api-key` 头（保留 `Authorization: Bearer`）。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 请求翻译 | `anthropicToOpenAI()`：Anthropic Messages（system / messages 内容块 / tools / tool_choice / stop_sequences / max_tokens）→ OpenAI Chat 兼容 body |
| 响应翻译 | `openAIToAnthropic()`：OpenAI Chat 响应 → Anthropic Messages（content 块 / stop_reason / usage） |
| 流式翻译 | `OpenAIAnthropicStreamTransformer`：上游 OpenAI SSE → Anthropic SSE（message_start / content_block_start / content_block_delta / content_block_stop / message_delta / message_stop） |
| 端点 | `POST /v1/messages`（controller 增路由，service 增 `messages` / `streamMessages`），复用 `prepare` + `requestUpstream` + `recordUsage` |
| 鉴权 | `ApiKeyAuthGuard` 兼容 `x-api-key`（Anthropic）与 `Authorization: Bearer`（OpenAI） |
| 范围限制 | v1 覆盖 text / image / tool_use / tool_result；thinking 块暂丢弃（后续按上游 reasoning 支持再补） |

## 4. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [ANTHROPIC_OUTWARD_REQ-001](../requirement/ANTHROPIC_OUTWARD_REQ-001_MESSAGES_ENDPOINT.md) | 后端：请求/响应/流式翻译 + `/v1/messages` + guard 兼容 x-api-key | 非流式与流式返回 Anthropic 格式；x-api-key 与 Bearer 均可鉴权；lint/typecheck/test 通过 |

## 5. 里程碑

1. ⬜ REQ-001 后端：翻译层 + `/v1/messages` + guard 兼容。

## 6. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| C-01 | thinking 块（Anthropic extended thinking）请求侧暂丢弃；流式 reasoning 回填后续按上游（DeepSeek `reasoning_content`）再补 | v1 不做 |
| C-02 | 多 content block / tool_use 流式索引边界需单测覆盖 | 实现中覆盖 |

## 7. 关联

- feature：`docs/feature/model_provider.md`
- 上游：`OFFICIAL_API_PLAN.md`、`OFFICIAL_CHANNEL_DUAL_FORMAT_PLAN.md`
