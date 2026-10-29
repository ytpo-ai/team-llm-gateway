# USAGE_METERING_REQ-002 开发记录（后端 OpenAI 兼容转发层）

> 对应需求：`docs/requirement/USAGE_METERING_REQ-002_BACKEND_PROXY.md`
> 对应计划：`docs/plan/USAGE_METERING_PLAN.md`
> 分支：`main`

## 1. 实现摘要

落地 OpenAI 兼容转发层：成员 key（`pk_`）鉴权 → 模型/上游解析 → 转发到上游 → 采集 token → 计量落库，闭环 ADR-09 与 `MODEL_PROVIDER_PLAN` M-01。

- `ApiKeyAuthGuard`：解析 `Authorization: Bearer pk_...`，sha256 哈希查 `ApiKey.keyHash`，校验 `status=active`、`expiresAt` 未过期；注入 `@ApiKeyContextParam()`（tenantId/teamId/userId/apiKeyId/apiKey）。
- `ProxyService`：
  - `listModels`：返回团队 active 模型目录（OpenAI 格式），按 key `allowedModels` 过滤。
  - `chatCompletions`（非流式）：模型解析（modelId/aliases 匹配）→ `allowedModels` 白名单校验 → provider 解析 + 解密上游 key → `fetch` 转发 → 解析 `usage` → `UsageService.record()` + `lastUsedAt`。
  - `streamChatCompletions`（SSE）：`stream:true` 时注入 `stream_options.include_usage=true`，管道透传上游 body，边读边从 `data:` 行提取 `usage`，流结束后 `record()`。
- 上游仅 `openai-compatible`；`anthropic` 类型拒绝（M-02 后置）。上游 key 明文仅内存中使用，不落日志。
- 路由 `@Controller('v1')`（不挂 `/api` 前缀，OpenAI 客户端直连）：`GET /v1/models`、`POST /v1/chat/completions`。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `modules/proxy/decorators/api-key-context.decorator.ts` | `ApiKeyContext` 接口 + `@ApiKeyContextParam()` |
| `modules/proxy/guards/api-key-auth.guard.ts` | 成员 key 鉴权守卫 |
| `modules/proxy/proxy.service.ts` | 模型/上游解析、转发、SSE 透传、计量联动 |
| `modules/proxy/proxy.controller.ts` | `/v1/models`、`/v1/chat/completions` |
| `modules/proxy/proxy.module.ts` | 模块装配（forFeature ApiKey/Model/Provider） |
| `modules/proxy/proxy.service.spec.ts` | 单测（5 例：listModels 过滤/非流式计量/白名单拒绝/anthropic 拒绝/SSE 提取） |

### 修改

| 文件 | 说明 |
|---|---|
| `app.module.ts` | 注册 `ProxyModule` |

## 3. 踩坑记录

1. **`Response` 类型命名冲突**：`fetch` 返回 undici `Response`，与 `express` 的 `Response` 同名；将 express 导入改为 `import type { Response as ExpressResponse }`，`requestUpstream` 返回类型显式标注 `globalThis.Response`。
2. **装饰器签名类型必须 `import type`**：`isolatedModules + emitDecoratorMetadata` 下，装饰方法参数里的接口类型（`ApiKeyContext`）必须用 `import type` 引入，否则 `tsc` 报 TS1272。
3. **SSE 用量提取缓冲裁剪**：持续追加的 SSE buffer 用 `.slice(-8192)` 裁剪，避免大响应下内存无界增长；`[DONE]` 行跳过，`JSON.parse` 失败静默忽略。
4. **单测依赖注入 token**：`ProxyService` 注入 `ConfigService`/`UsageService` 时，测试须用类作 token（`{ provide: ConfigService, useValue: mock }`），不能用字符串，否则 Nest 报「can't resolve dependencies」。

## 4. 验证结果

- `pnpm --filter portal-backend lint`：0 errors / 0 warnings。
- `pnpm --filter portal-backend typecheck`：通过。
- `pnpm --filter portal-backend build`：通过。
- `pnpm --filter portal-backend test`：48 passed（新增 proxy 5）。

## 5. 关联

- feature：`docs/feature/usage_metering.md`、`docs/feature/model_provider.md`
- 数据模型：`docs/technical/db_schema/USAGE_METERING_SCHEMA.MD` §4
- 待决事项：U-01（rateLimit/maxTokens 后置）、U-02（Anthropic 翻译）、U-03（流式缺 usage 按 0 计）见 `docs/plan/USAGE_METERING_PLAN.md` §7。
