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
- 查询 API：`GET /usage/summary`、`/usage/trends`、`/usage/by-model`、`/usage/by-member`、`/usage/by-key`。
- RBAC：`member` 仅本人，`team_admin`/`finance`/`viewer` 团队全量。

## 2. 需求追溯

| Plan | Requirement | Development | Fix |
|------|------------|-------------|-----|
| [USAGE_METERING](../plan/USAGE_METERING_PLAN.md) | [REQ-001 后端计量](../requirement/USAGE_METERING_REQ-001_BACKEND_METERING.md) | [开发记录](../development/USAGE_METERING_REQ-001_DEVELOPMENT.md) | — |
| 同上 | [REQ-002 后端转发层](../requirement/USAGE_METERING_REQ-002_BACKEND_PROXY.md) | [开发记录](../development/USAGE_METERING_REQ-002_DEVELOPMENT.md) | — |
| 同上 | [REQ-003 前端用量看板](../requirement/USAGE_METERING_REQ-003_FRONTEND_DASHBOARD.md) | [开发记录](../development/USAGE_METERING_REQ-003_DEVELOPMENT.md) | — |

## 3. 相关文档
- 技术文档：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-06、§7.1、D-05）、`docs/technical/db_schema/USAGE_METERING_SCHEMA.MD`
- 规划文档：`docs/plan/USAGE_METERING_PLAN.md`

## 4. 相关代码文件
- 后端：`apps/portal-backend/src/modules/usage/`、`apps/portal-backend/src/modules/proxy/`
- 前端：`apps/portal-frontend/src/features/usage/`、`pages/dashboard.tsx`
