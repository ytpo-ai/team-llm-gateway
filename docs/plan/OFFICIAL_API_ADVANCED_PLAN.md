# 官方 API 接入（增强：工具调用 + 多模态 + OAuth）开发计划（OFFICIAL_API_ADVANCED）

> 本 plan 固化「官方 API 接入」的**增强能力**：Anthropic 工具调用/vision 多模态翻译（O-01）、Gemini OAuth 服务账号认证（O-02），在 `docs/plan/OFFICIAL_API_PLAN.md` 已交付的适配层之上增量扩展。
>
> - 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-04/09/13、§5.2）
> - 上游 plan：`docs/plan/OFFICIAL_API_PLAN.md`（§6 待决 O-01/O-02 在本 plan 升级为需求）
> - 定稿时间：2026-10-29
> - 状态：已批准（实现方式确定为「直接接入官方接口」raw HTTP 适配器，不引入 SDK）

---

## 1. 需求背景

`OFFICIAL_API_PLAN` 已交付 OpenAI 兼容 / Anthropic / Gemini 三类协议的纯文本 chat 翻译与转发。但首期仅支持纯文本消息，`AnthropicAdapter` 未处理工具调用（`tool_use`/`tool_result`）与图片内容块（O-01）；`GeminiAdapter` 仅支持 `x-goog-api-key`，未支持服务账号 OAuth（O-02）。现补齐这两项增强，使直连官方具备完整生产能力（Agent 工具调用、多模态）。

> 实现方式（已决策）：**直接接入官方接口**，在现有适配器内手写内容块/工具映射；不引入 Vercel AI SDK 或官方 SDK。理由见 `docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD` 及 plan 讨论：OpenAI 格式是网关对外契约，SDK 会抽象掉该格式导致双重翻译。

## 2. 目标

1. Anthropic 工具调用翻译：OpenAI `tools/tool_choice/tool_calls/tool` 消息 ↔ Anthropic `tools/tool_choice/tool_use/tool_result`（请求/响应/流式）。
2. Anthropic vision 内容块翻译：OpenAI `image_url` 内容块 ↔ Anthropic `image` 内容块（base64 数据）。
3. Gemini OAuth 服务账号认证：服务账号 JSON → JWT → access_token 换取 + 缓存，`Authorization: Bearer` 调用。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 实现位置 | 均在现有 `modules/proxy/adapters/` 内扩展，不改对外契约（OpenAI 格式） |
| 工具调用（请求） | OpenAI `tools[].function.{name,description,parameters}` → Anthropic `tools[].{name,description,input_schema}`；`tool_choice`（auto/none/required/指定 function）→ Anthropic `{type:auto/any/tool, name?}` |
| 工具调用（响应） | Anthropic `content[].type==='tool_use'` → OpenAI `choices[].message.tool_calls[]`（`id→id`、`name→function.name`、`input→function.arguments`(JSON string)）；`stop_reason==='tool_use'` → `finish_reason='tool_calls'` |
| 工具结果消息 | OpenAI `{role:'tool', tool_call_id, content}` → Anthropic `{role:'user', content:[{type:'tool_result', tool_use_id, content}]}` |
| 工具调用（流式） | `content_block_start`(tool_use) + `content_block_delta`(input_json_delta) 累积 → 流式 `tool_calls` delta |
| vision 内容块 | OpenAI `{type:'image_url', image_url:{url}}` → Anthropic `{type:'image', source:{type:'base64', media_type, data}}`；`data:` URL 直接解析；远程 http(s) URL 服务端拉取转 base64（含 SSRF 防护） |
| Gemini OAuth | `Provider` 新增可选 `authType`（`api-key`/`oauth`，默认 `api-key`）；`oauth` 下 `apiKey` 字段存服务账号 JSON（仍 AES-256-GCM 加密）；`GeminiAdapter` 解析 client_email/private_key/token_uri → 签 JWT → 换 access_token（内存缓存 ~1h） |
| 接口调整 | `buildRequest` 由同步改为异步（`Promise<AdapterRequest>`），波及 `ProxyService.prepare()`（已 async）与 `ProvidersService.test()`（已 async），改动收敛 |
| 依赖 | 零新增运行时依赖（OAuth JWT 用 `node:crypto` 的 `crypto.sign` RS256） |

## 4. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [OFFICIAL_API_REQ-005](../requirement/OFFICIAL_API_REQ-005_ANTHROPIC_TOOL_VISION.md) | Anthropic 工具调用 + vision 内容块翻译（请求/响应/流式）+ 单测 | 工具调用与多模态请求正确翻译并计量；流式 tool_calls 正确映射；单测覆盖固定 fixture；lint/typecheck/test 通过 |
| [OFFICIAL_API_REQ-006](../requirement/OFFICIAL_API_REQ-006_GEMINI_OAUTH.md) | Gemini OAuth 服务账号认证（authType + token 交换 + 缓存）+ 单测 | `oauth` 渠道以 Bearer token 调用成功；token 内存缓存生效；lint/typecheck/test 通过 |

## 5. 里程碑

1. [x] REQ-005 Anthropic 工具调用 + vision 翻译（闭环 O-01）。
2. [x] REQ-006 Gemini OAuth 认证（闭环 O-02）。

## 6. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| A-01 | Anthropic vision 远程图片 URL（非 data URL）是否首期支持 | ✅ 已交付（支持 data: base64 + 远程 http(s) URL 拉取转 base64，含 SSRF 防护拦截内网/回环/云元数据） |
| A-02 | OAuth token 缓存有效期与刷新策略 | ✅ 已交付（可插拔 `TokenCache`：默认内存缓存，配置 `REDIS_URL` 时切换 Redis，多实例共享） |
| A-03 | 官方 SDK 是否作为翻译参考 | 仅作参考，不引入依赖 |

## 7. 关联

- 上游：`OFFICIAL_API_PLAN.md`、`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`
- feature：`docs/feature/model_provider.md`
- requirement：见 §4
