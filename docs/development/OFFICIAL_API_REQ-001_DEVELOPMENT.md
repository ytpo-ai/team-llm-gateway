# OFFICIAL_API_REQ-001 开发记录（后端协议适配层）

> 对应需求：`docs/requirement/OFFICIAL_API_REQ-001_BACKEND_ADAPTER.md`
> 对应计划：`docs/plan/OFFICIAL_API_PLAN.md`
> 分支：`main`

## 1. 实现摘要

在转发层之上落地「上游协议适配层」骨架：`ProviderType` 扩展 `gemini`，新增 `UpstreamAdapter` 抽象与工厂路由，将原有 OpenAI 兼容直通逻辑重构为 `OpenAICompatibleAdapter`，`ProxyService` 由「直通拼 URL」改为「按 `provider.type` 路由到适配器」，行为不回归。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `modules/proxy/adapters/upstream-adapter.ts` | `UpstreamAdapter`/`StreamTransformer`/`AdapterRequest` 等类型 + `splitSseEvents`/`parseJsonObject`/`asString`/`trimTrailingSlash` 工具 |
| `modules/proxy/adapters/openai-compatible.adapter.ts` | OpenAI 兼容基线适配器（直通 + usage 提取） |
| `modules/proxy/adapters/adapter.factory.ts` | `resolveAdapter(type)` 工厂注册表 |

### 修改

| 文件 | 说明 |
|---|---|
| `modules/providers/schemas/provider.schema.ts` | `ProviderType` 新增 `GEMINI = 'gemini'` |
| `modules/proxy/proxy.service.ts` | `prepare()` 路由到适配器生成请求；`chatCompletions`/`streamChatCompletions` 使用适配器解析/流式翻译；移除直通 `extractUsage`/`tryParseJson` |
| `modules/proxy/proxy.service.spec.ts` | 移除「拒绝 anthropic」旧用例，其余回归保持 |

## 3. 踩坑记录

1. **流式翻译状态机**：Anthropic/Gemini 的 SSE 事件与 OpenAI 完全不同，`StreamTransformer` 需按 `\n\n` 切分完整事件、缓冲不完整片段、`finish()` 时补 `[DONE]`；跨 chunk 的 `\r\n` 通过切分前整体 `replace(/\r\n/g,'\n')` 归一。
2. **`unknown` 字段 String 化**：`Record<string, unknown>` 取值后直接 `String(x)` 触发 oxlint `no-base-to-string`，统一走 `asString(value, fallback)` 工具。

## 4. 验证结果

- `pnpm --filter portal-backend lint`：0 errors / 0 warnings。
- `pnpm --filter portal-backend typecheck`：通过。
- `pnpm --filter portal-backend build`：通过。
- `pnpm --filter portal-backend test`：112 passed。

## 5. 关联

- feature：`docs/feature/model_provider.md`
- 计划：`docs/plan/OFFICIAL_API_PLAN.md`
