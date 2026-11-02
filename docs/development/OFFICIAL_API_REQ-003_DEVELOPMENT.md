# OFFICIAL_API_REQ-003 开发记录（Google Gemini 协议翻译）

> 对应需求：`docs/requirement/OFFICIAL_API_REQ-003_GEMINI.md`
> 对应计划：`docs/plan/OFFICIAL_API_PLAN.md`
> 分支：`main`

## 1. 实现摘要

实现 `GeminiAdapter`：OpenAI Chat Completions ↔ Gemini generateContent API 的请求/响应/流式/usage/认证完整翻译。

- 请求：messages → `contents[].parts[].text`（system → 顶层 `systemInstruction`）；`max_tokens→generationConfig.maxOutputTokens`、`temperature`、`top_p→topP`。
- 认证：`x-goog-api-key`。
- 端点：`${baseUrl}/v1beta/models/{modelId}:generateContent`（非流式）/`:streamGenerateContent?alt=sse`（流式）。
- 响应：`candidates[].content.parts[].text` → `choices[].message.content`；`usageMetadata` → usage。
- 流式：SSE `data:` 块（`alt=sse`）→ OpenAI `chat.completion.chunk`。

## 2. 代码改动点

| 文件 | 说明 |
|---|---|
| `modules/proxy/adapters/gemini.adapter.ts` | `GeminiAdapter` + `GeminiStreamTransformer` |
| `modules/proxy/adapters/gemini.adapter.spec.ts` | 单测（5 例：类型/请求/响应/流式） |

## 3. 踩坑记录

1. Gemini 流式默认返回 JSON 数组流，改用 `alt=sse` 查询参数使其返回 SSE，复用 `splitSseEvents` 统一解析，避免单独处理 JSON 数组流。

## 4. 验证结果

- 后端 lint/typecheck/build/test 全部通过（112 passed，含 gemini 5 例）。

## 5. 关联

- feature：`docs/feature/model_provider.md`
- 计划：`docs/plan/OFFICIAL_API_PLAN.md`
- 待决：O-02（Gemini OAuth 服务账号后置）
