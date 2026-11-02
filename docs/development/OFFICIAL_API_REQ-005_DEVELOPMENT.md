# OFFICIAL_API_REQ-005 开发记录（Anthropic 工具调用 + vision 翻译）

> 对应需求：`docs/requirement/OFFICIAL_API_REQ-005_ANTHROPIC_TOOL_VISION.md`
> 对应计划：`docs/plan/OFFICIAL_API_ADVANCED_PLAN.md`
> 分支：`main`

## 1. 实现摘要

在 `AnthropicAdapter` 基础上补齐工具调用与多模态内容块翻译（闭环 O-01），采用直接接入官方接口（raw HTTP）实现，不引入 SDK。

- 工具调用（请求）：OpenAI `tools[].function.{name,description,parameters}` → Anthropic `tools[].{name,description,input_schema}`；`tool_choice`（auto/none/required/指定 function）→ `{type:auto/none/any/tool, name?}`。
- 工具结果消息：OpenAI `{role:'tool', tool_call_id, content}` → Anthropic `{role:'user', content:[{type:'tool_result', tool_use_id, content}]}`。
- 工具调用（响应）：`content[].type==='tool_use'` → OpenAI `tool_calls[]`（`id`/`function.name`/`function.arguments`(JSON 字符串)）；`stop_reason==='tool_use'` → `finish_reason='tool_calls'`。
- 工具调用（流式）：`content_block_start`(tool_use) + `content_block_delta`(`input_json_delta`) 累积 → 流式 `tool_calls` delta。
- vision：OpenAI `image_url`（`data:` base64 直接解析；远程 http(s) URL 服务端拉取转 base64）→ Anthropic `image` 内容块。

## 2. 代码改动点

| 文件 | 说明 |
|---|---|
| `modules/proxy/adapters/anthropic.adapter.ts` | 重写：async `buildRequest` + tools/tool_choice/tool_result/vision 翻译；`parseResponse` 支持 tool_use；`AnthropicStreamTransformer` 支持 tool_use 流式 |
| `modules/proxy/adapters/anthropic.adapter.spec.ts` | 新增工具调用/vision/流式用例（10 例） |

## 3. 踩坑记录

1. **远程图片拉取**：Anthropic 只接受 base64 图片，远程 URL 需服务端 fetch 转 base64（`content-type` 或 URL 扩展名推断 `media_type`）；`buildRequest` 因此改为 async。
2. **流式 tool_calls**：OpenAI 流式工具调用分「首块（含 id/name/空 arguments）+ 后续 arguments 片段」，需在 transformer 内用 `content_block` index 维护每个块的累积状态，`input_json_delta` 逐片拼接。

## 4. 验证结果

- 后端：lint 0/0、typecheck 通过、build 通过、test 118 passed（含 anthropic 10 例）。

## 5. 关联

- feature：`docs/feature/model_provider.md`
- 计划：`docs/plan/OFFICIAL_API_ADVANCED_PLAN.md`
- 待决：A-01（远程图片 SSRF 白名单后置）
