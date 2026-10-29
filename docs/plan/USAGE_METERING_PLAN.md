# 计量与用量 + 转发层开发计划（USAGE_METERING）

> 本 plan 固化 Portal 业务模块 **计量与用量（usage_metering）** 的工程方案，并一并交付 **OpenAI 兼容转发层（M-01）** 作为计量数据的上游来源，形成「成员 key → Portal → 上游 key 转发 → 计量落库 → 三级聚合 → 用量看板」的完整闭环。
>
> - 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-04/06/09/10、§3 核心解耦原则、§5.2、§7.1、D-05）
> - 上游 plan：`docs/plan/MODEL_PROVIDER_PLAN.md`（M-01 转发层里程碑在本 plan 闭环）、`docs/plan/API_KEY_PLAN.md`（成员 key 已交付）
> - 定稿时间：2026-10-29
> - 状态：已批准

---

## 1. 需求背景

`model_provider` 已交付「模型目录（倍率 + 能力标签）+ 上游渠道」，`api_key` 已交付成员 key。但计量（成本 = 倍率 × token）、计费（统一扣费引擎）、选型建议都依赖「请求级用量流水」。同时，成员 key 尚无法真正发起模型请求（缺少 `/v1/*` 转发层）。现落地「计量与用量」模块：转发层校验成员 key → 解析模型/上游 → 转发并采集 token → 落库为 `UsageLog` → 团队/成员/Key 三级聚合 → 用量看板可视化。

## 2. 目标

1. 新增 `UsageLog` 实体：请求级用量流水（token 计数 + 倍率快照 + 成本 + 归属），详见 `docs/technical/db_schema/USAGE_METERING_SCHEMA.MD`。
2. 计量服务 `UsageService`：`record()` 上报（转发层进程内调用）+ 团队/成员/Key/模型/时间序列聚合查询。
3. 用量查询 API：`GET /usage/summary`、`/usage/trends`、`/usage/by-model`、`/usage/by-member`、`/usage/by-key`。
4. OpenAI 兼容转发层：`POST /v1/chat/completions` + `GET /v1/models`，成员 key（`pk_`）鉴权 + 模型/上游解析 + SSE 流式透传 + 计量联动。
5. 前端：用量看板（改造 `dashboard` 占位页）+ 趋势图 + 按模型/成员/Key 拆分。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 数据模型 | 新增 `UsageLog` 集合；详见 `docs/technical/db_schema/USAGE_METERING_SCHEMA.MD` |
| 计量口径 | `cost = multiplier × totalTokens`（倍率随请求快照落库；缓存计费/阶梯价后置到 billing_quota） |
| 上报入口 | `UsageService.record()` 进程内方法（转发层与 Portal 同进程，符合 ADR-09「成员请求先到 Portal」） |
| 转发认证 | `ApiKeyAuthGuard`：`Authorization: Bearer pk_...` → sha256 哈希 → `ApiKey.keyHash` 校验 status/expiresAt；注入 `@ApiKeyContext()` |
| 转发路由 | `@Controller('v1')`（不挂 `/api` 前缀，OpenAI 客户端直连）；`type=anthropic` 协议翻译后置（M-02） |
| 上游转发 | 模型 → 渠道解析 → 解密上游 key → `${baseUrl}/chat/completions`；`stream:true` 时 SSE 透传并注入 `stream_options.include_usage=true` 提取用量 |
| 团队隔离 | `UsageLog` 携带 `tenantId + teamId + userId + apiKeyId`，查询按租户/团队过滤 |
| 鉴权（查询） | 复用 `JwtAuthGuard`/`RolesGuard`；`member` 只看自己，`team_admin`/`finance`/`viewer` 看团队全量 |
| 前端 | React + TanStack Query；轻量图表（SVG/CSS 自绘，不引重型图表库，保持零新增依赖） |

## 4. RBAC 设计

| 资源 | 读 | 写 |
|---|---|---|
| `usage` 聚合查询 | `member` 仅本人；`team_admin`/`finance`/`viewer` 团队全量 | —（用量只增不改，无写接口） |
| `/v1/*` 转发 | 成员 key（`pk_`）鉴权，非 JWT | — |

- 用量数据为只读审计流水，无管理写接口；`UsageService.record()` 仅内部（转发层）调用。

## 5. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [USAGE_METERING_REQ-001](../requirement/USAGE_METERING_REQ-001_BACKEND_METERING.md) | 后端计量：`UsageLog` schema + `UsageService`（record + 三级聚合）+ 查询 API + 单测 | `start:dev` 启动，Swagger 可调 `/usage/*`，聚合结果正确，lint/typecheck/test 通过 |
| [USAGE_METERING_REQ-002](../requirement/USAGE_METERING_REQ-002_BACKEND_PROXY.md) | 后端转发层：`ApiKeyAuthGuard` + `/v1/chat/completions` + `/v1/models` + 模型/上游解析 + SSE + 计量联动 + 单测 | 成员 key 可转发到上游并落库用量；非法/过期 key 拒绝；lint/typecheck/test 通过 |
| [USAGE_METERING_REQ-003](../requirement/USAGE_METERING_REQ-003_FRONTEND_DASHBOARD.md) | 前端用量看板：总览卡片 + 趋势图 + 按模型/成员/Key 拆分 + 路由导航 | `dev`/`build` 通过，看板展示真实聚合数据，空态友好 |

## 6. 里程碑

1. ✅ REQ-001 后端计量（本文档拆解）。
2. ✅ REQ-002 后端转发层（闭环 MODEL_PROVIDER M-01）。
3. ✅ REQ-003 前端用量看板。

## 7. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| U-01 | `rateLimitPerMinute` / `maxTokens` 实时校验（需计数/累计额度） | 后置到 `billing_quota`，转发层仅校验 `allowedModels` 白名单 + status/expiresAt |
| U-02 | Anthropic 协议翻译（M-02） | 转发层仅支持 `openai-compatible` 上游，`anthropic` 类型暂拒绝 |
| U-03 | 流式无 `usage` 时 token 估算 | 转发时注入 `include_usage=true`；缺失则跳过计量（记日志），不阻塞响应 |
| U-04 | 上游连通性探活（M-03）、密钥轮换（M-04） | 后置 |
| U-05 | 图表库选型 | 首期 SVG/CSS 轻量自绘，避免引入重型图表依赖；后续可替换 |

## 8. 关联

- 上游：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`、`MODEL_PROVIDER_PLAN.md`、`API_KEY_PLAN.md`
- feature：`docs/feature/usage_metering.md`、`docs/feature/model_provider.md`
- 数据模型：`docs/technical/db_schema/USAGE_METERING_SCHEMA.MD`（本 plan 新增）
- requirement：见 §5
