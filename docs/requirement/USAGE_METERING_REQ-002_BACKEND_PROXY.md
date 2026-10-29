# USAGE_METERING_REQ-002 后端 OpenAI 兼容转发层

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/usage_metering.md`（闭环 `docs/feature/model_provider.md` M-01） |
| 所属 plan | `docs/plan/USAGE_METERING_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/usage-metering-proxy` |
| 状态 | `done` |

## 2. 需求描述

### 背景
成员 key（`pk_`）已交付，但无法真正发起模型请求。现落地 OpenAI 兼容转发层：成员 key 鉴权 → 模型/上游解析 → 转发到上游 → 采集 token → 计量落库（`UsageService.record`），闭环 ADR-09 与 `MODEL_PROVIDER_PLAN` M-01。

### 目标
- 新增 `ApiKeyAuthGuard`：解析 `Authorization: Bearer pk_...`，sha256 哈希后查 `ApiKey.keyHash`，校验 `status=active`、`expiresAt` 未过期；注入 `@ApiKeyContext()`（tenantId/teamId/userId/apiKeyId/apiKey）。
- 新增 `proxy` 模块（`@Controller('v1')`，不挂 `/api` 前缀）：
  - `POST /v1/chat/completions`：模型/上游解析、`allowedModels` 白名单校验、转发、SSE 流式透传、计量联动、更新 `lastUsedAt`。
  - `GET /v1/models`：返回 key 所属团队 active 模型目录（OpenAI 格式，按 `allowedModels` 过滤）。
- 上游 key 解密复用 `decrypt()`；上游仅支持 `openai-compatible`，`anthropic` 类型暂拒绝。
- 流式：`stream:true` 时注入 `stream_options.include_usage=true`，从 SSE chunk 提取 `usage` 并 `record()`；缺失则跳过计量不阻塞响应。

### 验收条件
- [x] 合法成员 key 可转发到上游并返回结果，用量落库 `usage_logs`。
- [x] 非法/过期/吊销 key 返回 401/403，不触达上游。
- [x] `allowedModels` 白名单命中校验生效；非白名单模型拒绝。
- [x] 流式（SSE）与非流式（JSON）均可用；上游 key 明文不落日志。
- [x] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过。

## 3. 技术方案摘要
- 复用 Node 22 全局 `fetch` 做上游转发；SSE 用 `@Res()` 管道透传并逐块解析。
- 鉴权独立于 JWT（成员 key 端点非登录态），`ApiKeyAuthGuard` 注入 `ApiKey` 模型直接校验。
- 技术细节见 `docs/plan/USAGE_METERING_PLAN.md` §3、`docs/technical/db_schema/USAGE_METERING_SCHEMA.MD` §4。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/USAGE_METERING_REQ-002_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
