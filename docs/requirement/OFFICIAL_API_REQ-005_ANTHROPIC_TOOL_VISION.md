# OFFICIAL_API_REQ-005 Anthropic 工具调用 + vision 内容块翻译

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/model_provider.md` |
| 所属 plan | `docs/plan/OFFICIAL_API_ADVANCED_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/official-api-anthropic-tool-vision` |
| 状态 | `done` |

## 2. 需求描述

### 背景
`AnthropicAdapter`（`OFFICIAL_API_REQ-002`）仅支持纯文本消息，未处理工具调用与多模态内容块（`OFFICIAL_API_PLAN` §6 O-01）。现补齐工具调用与 vision 翻译，使直连 Claude 支持 Agent 工具调用与图片理解。

### 目标
- **工具调用（请求）**：OpenAI `tools[].function.{name,description,parameters}` → Anthropic `tools[].{name,description,input_schema}`；`tool_choice`（`auto`/`none`/`required`/`{type:'function',function:{name}}`）→ Anthropic `{type:'auto'|'any'|'tool', name?}`。
- **工具结果消息**：OpenAI `{role:'tool', tool_call_id, content}` → Anthropic `{role:'user', content:[{type:'tool_result', tool_use_id, content}]}`。
- **工具调用（响应）**：Anthropic `content[]` 中 `type==='tool_use'` → OpenAI `choices[].message.tool_calls[]`（`id→id`、`name→function.name`、`input→function.arguments`(JSON 字符串)）；`stop_reason==='tool_use'` → `finish_reason='tool_calls'`。
- **工具调用（流式）**：`content_block_start`(tool_use 起始) + `content_block_delta`(`input_json_delta`) 累积拼接 arguments → 流式输出 `choices[].delta.tool_calls`。
- **vision 内容块**：OpenAI `content:[{type:'text'},{type:'image_url',image_url:{url}}]` → Anthropic `content:[{type:'text'},{type:'image',source:{type:'base64',media_type,data}}]`；`data:image/<type>;base64,<data>` 直接解析；远程 http(s) URL 服务端拉取转 base64（含 SSRF 校验，见 A-01）。
- 计量联动不变：usage 仍统一提取，走 `UsageService.record()` + 倍率。

### 验收条件
- [ ] 含 `tools` 的请求正确翻译为 Anthropic `tools` + `tool_choice`，转发成功。
- [ ] Anthropic `tool_use` 响应正确映射为 OpenAI `tool_calls`（含 `function.arguments` JSON 字符串）与 `finish_reason='tool_calls'`。
- [ ] OpenAI `role:'tool'` 消息正确映射为 Anthropic `tool_result`。
- [ ] 流式工具调用正确拼接 `input_json_delta` 并输出 `tool_calls` delta。
- [ ] `image_url`（data URL）正确映射为 Anthropic `image` 内容块（`media_type` + base64）。
- [ ] 单测覆盖请求/响应/流式/vision 映射（固定 fixture）；`lint`/`typecheck`/`test` 通过。

## 3. 技术方案摘要
- 映射要点见 `docs/plan/OFFICIAL_API_ADVANCED_PLAN.md` §3。
- 在 `AnthropicAdapter` / `AnthropicStreamTransformer` 内扩展 `toTextParts` 为通用内容块转换 + 工具映射。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/OFFICIAL_API_REQ-005_DEVELOPMENT.md`（待补充） |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
