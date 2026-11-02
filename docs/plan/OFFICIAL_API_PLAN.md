# 官方 API 接入（后端协议翻译层）开发计划（OFFICIAL_API）

> 本 plan 固化 Portal 直连官方 LLM 的**后端协议翻译层**工程方案，落地 ADR-13「proxy 是 gateway 首选上游、可旁路」的旁路侧（直连官方），使 Portal 上游从「仅 OpenAI 兼容直通」扩展为「OpenAI 兼容 / Anthropic Messages / Google Gemini」三类官方协议的统一接入。
>
> - 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-04/05/09/13、§3 核心解耦原则、§5.2、D-05）
> - 上游 plan：`docs/plan/MODEL_PROVIDER_PLAN.md`（M-02 Anthropic 协议翻译在本 plan 闭环）、`docs/plan/USAGE_METERING_PLAN.md`（U-02 转发层仅 openai-compatible 的约束在本 plan 解除）
> - 定稿时间：2026-10-29
> - 状态：已完成（首期协议范围 = Anthropic + Gemini；预置目录与探活见姊妹 plan `OFFICIAL_API_PRESET_PLAN.md`）

---

## 1. 需求背景

转发层（`apps/portal-backend/src/modules/proxy/`）当前是**纯 OpenAI 格式直通**：`${baseUrl}/chat/completions` + `Authorization: Bearer`，`ProviderType` 只有 `openai-compatible`（默认）与 `anthropic`（枚举位已保留但 `proxy.service.ts` 直接拒绝）。这只能接入 OpenAI 兼容上游（OpenAI/DeepSeek/Moonshot/Qwen 等），无法直连 **Anthropic Claude**（Messages API）与 **Google Gemini**（generateContent API）——两者协议、认证、流式事件与 OpenAI 均不兼容。

现落地「协议翻译层」：在内部统一 OpenAI Chat Completions 格式的前提下，按 `provider.type` 路由到对应适配器完成「请求翻译 → 转发 → 响应/流式翻译 → usage 统一提取」，对成员 key 完全透明，成员侧仍使用 OpenAI 格式。

## 2. 目标

1. 扩展 `ProviderType`：`openai-compatible` / `anthropic` / `gemini`。
2. 新增**上游适配器抽象**（Adapter 接口 + 工厂路由），OpenAI 兼容作为基线适配器（保持现状行为不回归）。
3. 新增 **Anthropic 适配器**：请求/响应/流式/usage/认证翻译。
4. 新增 **Gemini 适配器**：请求/响应/流式/usage/认证翻译。
5. 改造 `ProxyService`：由「直通拼 URL」改为「按类型路由到适配器」，计量联动（倍率×token）不变。
6. 单元测试覆盖各适配器的格式映射（含流式事件）与 openai-compatible 回归。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 内部规范 | 以 OpenAI Chat Completions 为**唯一内部表示**（成员 key 侧与计量侧均无感），各适配器负责与官方协议互转 |
| 适配器抽象 | `modules/proxy/adapters/` 下定义 `UpstreamAdapter` 接口：`type`、`buildRequest()`（url/headers/body）、`parseResponse()`（非流式）、`extractUsage()`（流式 usage 提取）、`mapError()`（错误归一）；工厂按 `provider.type` 返回对应适配器 |
| Provider 类型 | `ProviderType` 增加 `GEMINI = 'gemini'`（`anthropic` 已有）；存量数据默认 `openai-compatible`，无迁移 |
| 认证适配 | OpenAI：`Authorization: Bearer`；Anthropic：`x-api-key` + `anthropic-version: 2023-06-01`；Gemini：`x-goog-api-key` |
| 端点适配 | OpenAI：`/chat/completions`；Anthropic：`/v1/messages`；Gemini：`/v1beta/models/{modelId}:generateContent`（非流式）与 `:streamGenerateContent`（流式） |
| usage 映射 | OpenAI：`usage.prompt_tokens/completion_tokens/total_tokens`；Anthropic：`usage.input_tokens/output_tokens`；Gemini：`usageMetadata.promptTokenCount/candidatesTokenCount/totalTokenCount` |
| 流式翻译 | Anthropic SSE（`message_start/content_block_delta/message_delta/message_stop`）与 Gemini 流式 → 转 OpenAI `chat.completion.chunk` 事件；usage 从 `message_delta`/`usageMetadata` 提取 |
| 计量联动 | 翻译后统一走既有 `UsageService.record()` + `BillingService.deduct()`（倍率×totalTokens），不改计量口径 |
| 依赖 | 零新增运行时依赖（node 原生 `fetch`/`crypto`/`TextDecoder`） |

### 3.1 关键协议差异（翻译要点）

**Anthropic Messages**：
- `system` 从 messages 数组拆出为顶层 `system` 字段；角色映射 `assistant→assistant`、`user→user`、`tool→user`。
- `max_tokens` **必填**：OpenAI 侧无 `max_tokens`/`max_completion_tokens` 时需按模型设默认（如 4096）。
- 仅支持 `temperature`/`top_p` 等有限参数，其余 OpenAI 参数忽略/降级。
- 流式：`message_delta` 携带 `usage.output_tokens` 与 `stop_reason`；`content_block_delta` 的 `delta.text` 映射为 `choices[].delta.content`。

**Google Gemini**：
- messages → `contents[].parts[].text`（系统提示词拆为 `systemInstruction`）；参数 → `generationConfig`（`maxOutputTokens`/`temperature`）。
- 响应 `candidates[].content.parts[].text` → `choices[].message.content`；`usageMetadata` → usage。
- 流式：`streamGenerateContent` 返回数组块，逐个映射为 OpenAI chunk。

## 4. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [OFFICIAL_API_REQ-001](../requirement/OFFICIAL_API_REQ-001_BACKEND_ADAPTER.md) | 后端适配层：`ProviderType` 扩展 + `UpstreamAdapter` 抽象 + 工厂路由 + `ProxyService` 改造 + openai-compatible 基线适配器 + 回归 | openai-compatible 行为不变；新类型枚举就绪；lint/typecheck/test 通过 |
| [OFFICIAL_API_REQ-002](../requirement/OFFICIAL_API_REQ-002_ANTHROPIC.md) | Anthropic 适配器：请求/响应/流式/usage/认证翻译 + 单测 | `type=anthropic` 渠道可转发并正确计量；流式事件正确映射；test 通过 |
| [OFFICIAL_API_REQ-003](../requirement/OFFICIAL_API_REQ-003_GEMINI.md) | Gemini 适配器：请求/响应/流式/usage/认证翻译 + 单测 | `type=gemini` 渠道可转发并正确计量；流式事件正确映射；test 通过 |

> 预置目录 + 连通性探活 + 前端在姊妹 plan `docs/plan/OFFICIAL_API_PRESET_PLAN.md`。

## 5. 里程碑

1. ✅ REQ-001 后端适配层（本文档拆解）。
2. ✅ REQ-002 Anthropic 协议翻译（闭环 MODEL_PROVIDER M-02）。
3. ✅ REQ-003 Gemini 协议翻译。
4. ✅ 前端 + 官方预置目录 + 探活（`OFFICIAL_API_PRESET_PLAN.md`）。

## 6. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| O-01 | Anthropic 工具调用（`tool_use`/`tool_result`）与 vision 内容块翻译 | 首期支持纯文本消息；工具/多模态内容块翻译后置 |
| O-02 | Gemini 认证 OAuth（服务账号） | 首期仅 `x-goog-api-key`；OAuth 后置 |
| O-03 | 官方流式格式兼容性（各家 SSE 边界差异） | 以官方文档为准，适配器单测用固定 fixture 覆盖 |
| O-04 | `max_tokens` 缺省默认值策略 | Anthropic 必填；按模型设默认值，可后续做成配置项 |

## 7. 关联

- 上游：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`、`MODEL_PROVIDER_PLAN.md`、`USAGE_METERING_PLAN.md`
- 姊妹 plan：`OFFICIAL_API_PRESET_PLAN.md`
- feature：`docs/feature/model_provider.md`
- requirement：见 §4
