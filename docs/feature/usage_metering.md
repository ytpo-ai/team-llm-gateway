# 计量与用量（usage_metering）

## 1. 功能设计

### 目标
- 请求日志采集、token 计量、成本计算（倍率 × token）。
- 团队/成员/key 三级聚合。
- 用量可视化：看板、趋势、按模型/成员/场景拆分。
- 落实 ADR-06「团队级细粒度计量」；初期 MongoDB 聚合。

### 数据结构
- `UsageLog`（请求级用量流水）：`docs/technical/db_schema/USAGE_METERING_SCHEMA.MD`。

### 核心逻辑
- 计量口径：`cost = multiplier × totalTokens`（倍率随请求快照落库）。
- 上报：`UsageService.record()` 进程内方法，由 OpenAI 兼容转发层（`/v1/chat/completions`）在转发后调用。
- 转发层：成员 key（`pk_`）鉴权 → 模型/上游解析 → 转发 → 采集 token → 落库（闭环 ADR-09 / M-01）。
- 渠道健康感知（纯被动信号，无上游用量 API 依赖）：429 → `markExhausted()`（恢复时间取响应头或退避窗口）；5xx/408/网络错误 → `recordFailure()` 累计熔断冷却；成功 → `recordSuccess()` 重置；响应头 `x-ratelimit-*` 提取速率信息。
- **多渠道 fallback**：转发层按 `Model.providerBindings` 优先级遍历候选渠道，`getAvailability()` 跳过限流中/冷却中渠道，网络错误自动切换下一候选。
- 查询 API：`GET /usage/summary`、`/usage/trends`、`/usage/by-model`、`/usage/by-member`、`/usage/by-key`、`/usage/by-provider`。
- RBAC：`member` 仅本人，`team_admin`/`system` 团队全量。

## 2. 需求追溯

| Plan | Requirement | Development | Fix |
|------|------------|-------------|-----|
| [USAGE_METERING](../plan/USAGE_METERING_PLAN.md) | [REQ-001 后端计量](../requirement/USAGE_METERING_REQ-001_BACKEND_METERING.md) | [开发记录](../development/USAGE_METERING_REQ-001_DEVELOPMENT.md) | — |
| 同上 | [REQ-002 后端转发层](../requirement/USAGE_METERING_REQ-002_BACKEND_PROXY.md) | [开发记录](../development/USAGE_METERING_REQ-002_DEVELOPMENT.md) | [listModels 排除僵尸模型](../issue/fix/2026-11-04-provider-disable-cascade.md) |
| 同上 | [REQ-003 前端用量看板](../requirement/USAGE_METERING_REQ-003_FRONTEND_DASHBOARD.md) | [开发记录](../development/USAGE_METERING_REQ-003_DEVELOPMENT.md) | — |
| [TEAM_MANAGEMENT_OPTIMIZATION](../plan/TEAM_MANAGEMENT_OPTIMIZATION_PLAN.md) | [REQ-003 系统管理员+菜单](../requirement/TEAM_MANAGEMENT_REQ-003_SYSTEM_ADMIN_MENU.md) | [开发记录](../development/TEAM_MANAGEMENT_REQ-003_DEVELOPMENT.md) | — |
| [PROVIDER_USAGE_SENSE](../plan/PROVIDER_USAGE_SENSE_PLAN.md) | [REQ-001 后端数据模型+查询](../requirement/PROVIDER_USAGE_REQ-001_BACKEND_SCHEMA_QUERY.md) | [开发记录](../development/PROVIDER_USAGE_REQ-001_DEVELOPMENT.md) | — |
| 同上 | [REQ-002 转发层多渠道 fallback](../requirement/PROVIDER_USAGE_REQ-002_BACKEND_FALLBACK.md) | [同上](../development/PROVIDER_USAGE_REQ-001_DEVELOPMENT.md) | — |
| 同上 | [REQ-003 backend by-provider 聚合](../requirement/PROVIDER_USAGE_REQ-003_BACKEND_BY_PROVIDER.md) | [同上](../development/PROVIDER_USAGE_REQ-001_DEVELOPMENT.md) | — |
| 同上 | [REQ-004 前端展示](../requirement/PROVIDER_USAGE_REQ-004_FRONTEND.md) | [同上](../development/PROVIDER_USAGE_REQ-001_DEVELOPMENT.md) | — |
| [PROVIDER_USAGE_HEALTH](../plan/PROVIDER_USAGE_HEALTH_PLAN.md) | [REQ-005 移除主动查询链路](../requirement/PROVIDER_USAGE_REQ-005_REMOVE_ACTIVE_QUERY.md) | [开发记录](../development/PROVIDER_USAGE_REQ-005_DEVELOPMENT.md) | — |
| 同上 | [REQ-006 渠道健康模型+熔断冷却](../requirement/PROVIDER_USAGE_REQ-006_HEALTH_CIRCUIT_BREAKER.md) | [同上](../development/PROVIDER_USAGE_REQ-005_DEVELOPMENT.md) | — |
| 同上 | [REQ-007 前端健康状态列](../requirement/PROVIDER_USAGE_REQ-007_FRONTEND_HEALTH_COLUMN.md) | [同上](../development/PROVIDER_USAGE_REQ-005_DEVELOPMENT.md) | — |
| [PROXY_POLICY_PROTOCOL](../plan/PROXY_POLICY_PROTOCOL_PLAN.md) | [REQ-001 协议类型+PolicyResolver](../requirement/PROXY_POLICY_PROTOCOL_REQ-001_TYPES_RESOLVER.md)、[REQ-002 ProxyCore+MeterBackend](../requirement/PROXY_POLICY_PROTOCOL_REQ-002_CORE_METER.md) | [开发记录](../development/PROXY_POLICY_PROTOCOL_REQ-001_DEVELOPMENT.md) | — |

## 3. 相关文档
- 技术文档：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-06、§7.1、D-05）、`docs/technical/db_schema/USAGE_METERING_SCHEMA.MD`
- 规划文档：`docs/plan/USAGE_METERING_PLAN.md`

## 4. 相关代码文件
- 后端：`apps/portal-backend/src/modules/usage/`、`apps/portal-backend/src/modules/proxy/`
- 前端：`apps/portal-frontend/src/features/usage/`、`pages/dashboard.tsx`
