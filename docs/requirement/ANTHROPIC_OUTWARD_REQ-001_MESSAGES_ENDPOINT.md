# ANTHROPIC_OUTWARD_REQ-001 后端：对外 Anthropic Messages 端点

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/model_provider.md` |
| 所属 plan | `docs/plan/ANTHROPIC_OUTWARD_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/official-channel-dual-format` |
| 状态 | `in-review` |

## 2. 需求描述

### 背景
转发层仅 OpenAI 兼容端点，Claude Code / Anthropic SDK 无法直接接入。

### 目标
- 新增 `POST /v1/messages`：非流式返回 Anthropic Messages JSON；`stream=true` 返回 Anthropic SSE（`message_start` / `content_block_start` / `content_block_delta` / `content_block_stop` / `message_delta` / `message_stop`）。
- 请求翻译 `anthropicToOpenAI()`、响应翻译 `openAIToAnthropic()`、流式翻译 `OpenAIAnthropicStreamTransformer`。
- `ApiKeyAuthGuard` 兼容 `x-api-key` 头（与 `Authorization: Bearer` 等价）。

### 验收条件
- [ ] `POST /v1/messages`（非流式）返回 `{ type:'message', role:'assistant', content:[...], stop_reason, usage }`。
- [ ] `stream=true` 返回 Anthropic SSE 事件序列。
- [ ] `x-api-key` 与 `Authorization: Bearer` 均可鉴权；缺 key 返回 401。
- [ ] text / image / tool_use / tool_result 翻译正确（单测覆盖）。
- [ ] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过。

## 3. 技术方案摘要

- 见 `docs/plan/ANTHROPIC_OUTWARD_PLAN.md` §3。
- 翻译代码位于 `modules/proxy/adapters/anthropic-protocol.ts`，复用 `upstream-adapter.ts` 的 SSE 切分 / JSON 解析 / 字符串归一工具。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/ANTHROPIC_OUTWARD_REQ-001_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [ ] 待验收
- [ ] 已交付
