# 模型与上游（model_provider）

## 1. 功能设计

### 目标
- 上游接入：直连 LLM（OpenAI/Anthropic/…）、Gateway、任意第三方中转，统一 **OpenAI 兼容抽象**（§3 核心解耦原则）。
- 模型目录：可用模型清单 + 倍率 + 能力标签。
- 模型别名/映射。
- 落实 ADR-09「方案 A」：Portal 持团队上游 key，成员 key 由 Portal 签发并转发。

### 数据结构
- `Provider`（上游渠道）、`Model`（模型目录）：`docs/technical/db_schema/MODEL_PROVIDER_SCHEMA.MD`（上游 key 加密存储，仅脱敏 hint）。

### 核心逻辑
- 上游统一「OpenAI 兼容」抽象（§3 核心解耦原则）；`type` 保留 `anthropic` 位（协议翻译后续）。
- 上游 key AES-256-GCM 加密落库，明文仅创建/更新时输入、绝不返回。
- 模型目录：`modelId` + `multiplier`（倍率）+ `capabilities`（能力标签）+ `aliases`。
- OpenAI 兼容转发层（成员 key → Portal → 上游 key 转发，D-05）：已交付，见 `docs/plan/USAGE_METERING_PLAN.md`（M-01 闭环），代码在 `apps/portal-backend/src/modules/proxy/`。
- 官方直连一键开启：渠道管理页内置主流 LLM 官方预置（默认未开启），填 Key 即建官方直连渠道并自动导入官方模型（`POST /providers/from-preset`），`Provider.presetKey` 标记来源官方预置。

## 2. 需求追溯

| Plan | Requirement | Development | Fix |
|------|------------|-------------|-----|
| [MODEL_PROVIDER](../plan/MODEL_PROVIDER_PLAN.md) | [REQ-001 后端模型与上游](../requirement/MODEL_PROVIDER_REQ-001_BACKEND_PROVIDER_MODEL.md) | [开发记录](../development/MODEL_PROVIDER_REQ-001_DEVELOPMENT.md) | [禁用渠道级联禁用模型](../issue/fix/2026-11-04-provider-disable-cascade.md) |
| 同上 | [REQ-002 前端模型与上游管理](../requirement/MODEL_PROVIDER_REQ-002_FRONTEND_PROVIDER_MODEL.md) | [开发记录](../development/MODEL_PROVIDER_REQ-002_DEVELOPMENT.md) | — |
| [OFFICIAL_API](../plan/OFFICIAL_API_PLAN.md) | [REQ-001 后端适配层](../requirement/OFFICIAL_API_REQ-001_BACKEND_ADAPTER.md) | [开发记录](../development/OFFICIAL_API_REQ-001_DEVELOPMENT.md) | — |
| 同上 | [REQ-002 Anthropic 翻译](../requirement/OFFICIAL_API_REQ-002_ANTHROPIC.md) | [开发记录](../development/OFFICIAL_API_REQ-002_DEVELOPMENT.md) | — |
| 同上 | [REQ-003 Gemini 翻译](../requirement/OFFICIAL_API_REQ-003_GEMINI.md) | [开发记录](../development/OFFICIAL_API_REQ-003_DEVELOPMENT.md) | — |
| [OFFICIAL_API_PRESET](../plan/OFFICIAL_API_PRESET_PLAN.md) | [REQ-004 前端类型+预置+探活](../requirement/OFFICIAL_API_REQ-004_FRONTEND_PRESET_PROBE.md) | [开发记录](../development/OFFICIAL_API_REQ-004_DEVELOPMENT.md) | — |
| [OFFICIAL_API_ADVANCED](../plan/OFFICIAL_API_ADVANCED_PLAN.md) | [REQ-005 Anthropic 工具调用+vision](../requirement/OFFICIAL_API_REQ-005_ANTHROPIC_TOOL_VISION.md) | [开发记录](../development/OFFICIAL_API_REQ-005_DEVELOPMENT.md) | — |
| 同上 | [REQ-006 Gemini OAuth](../requirement/OFFICIAL_API_REQ-006_GEMINI_OAUTH.md) | [开发记录](../development/OFFICIAL_API_REQ-006_DEVELOPMENT.md) | — |
| [OFFICIAL_CHANNEL_PRESET](../plan/OFFICIAL_CHANNEL_PRESET_PLAN.md) | [REQ-007 后端预置+一键开启](../requirement/OFFICIAL_API_REQ-007_BACKEND_CHANNEL_PRESET.md) | [开发记录](../development/OFFICIAL_API_REQ-007_DEVELOPMENT.md) | — |
| 同上 | [REQ-008 前端官方直连卡片区](../requirement/OFFICIAL_API_REQ-008_FRONTEND_OFFICIAL_CHANNEL.md) | [开发记录](../development/OFFICIAL_API_REQ-008_DEVELOPMENT.md) | — |
| [OFFICIAL_CHANNEL_DUAL_FORMAT](../plan/OFFICIAL_CHANNEL_DUAL_FORMAT_PLAN.md) | [REQ-009 后端 formats+双格式](../requirement/OFFICIAL_API_REQ-009_BACKEND_DUAL_FORMAT.md) | [开发记录](../development/OFFICIAL_API_REQ-009_DEVELOPMENT.md) | — |
| 同上 | [REQ-010 前端统一添加入口](../requirement/OFFICIAL_API_REQ-010_FRONTEND_UNIFIED_ADD.md) | [开发记录](../development/OFFICIAL_API_REQ-010_DEVELOPMENT.md) | — |
| [OFFICIAL_CHANNEL_KIMI_CODE](../plan/OFFICIAL_CHANNEL_KIMI_CODE_PLAN.md) | [REQ-011 后端新增 Kimi Code 预置](../requirement/OFFICIAL_API_REQ-011_BACKEND_KIMI_CODE_PRESET.md) | [开发记录](../development/OFFICIAL_API_REQ-011_DEVELOPMENT.md) | — |
| [ANTHROPIC_OUTWARD](../plan/ANTHROPIC_OUTWARD_PLAN.md) | [REQ-001 对外 Anthropic Messages 端点](../requirement/ANTHROPIC_OUTWARD_REQ-001_MESSAGES_ENDPOINT.md) | [开发记录](../development/ANTHROPIC_OUTWARD_REQ-001_DEVELOPMENT.md) | — |
| [PROVIDER_MODEL_LIFECYCLE](../plan/PROVIDER_MODEL_LIFECYCLE_PLAN.md) | [REQ-001 后端渠道生命周期](../requirement/PROVIDER_MODEL_LIFECYCLE_REQ-001_BACKEND_PROVIDER.md) | [开发记录](../development/PROVIDER_MODEL_LIFECYCLE_REQ-001_DEVELOPMENT.md) | — |
| 同上 | [REQ-002 后端模型生命周期](../requirement/PROVIDER_MODEL_LIFECYCLE_REQ-002_BACKEND_MODEL.md) | [开发记录](../development/PROVIDER_MODEL_LIFECYCLE_REQ-002_DEVELOPMENT.md) | — |
| 同上 | [REQ-003 前端禁用/启用/删除](../requirement/PROVIDER_MODEL_LIFECYCLE_REQ-003_FRONTEND.md) | [开发记录](../development/PROVIDER_MODEL_LIFECYCLE_REQ-003_DEVELOPMENT.md) | — |
| [TEAM_CONTEXT_SWITCH](../plan/TEAM_CONTEXT_SWITCH_PLAN.md) | [REQ-004 团队选择器与上下文切换](../requirement/TEAM_MEMBER_REQ-004_TEAM_SELECTOR.md) | [开发记录](../development/TEAM_MEMBER_REQ-004_DEVELOPMENT.md) | — |

## 3. 相关文档
- 技术文档：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（§3、ADR-09/10、D-05）、`docs/technical/db_schema/MODEL_PROVIDER_SCHEMA.MD`
- 规划文档：`docs/plan/MODEL_PROVIDER_PLAN.md`
- 上游：`docs/plan/API_KEY_PLAN.md`

## 4. 相关代码文件
- 后端：`apps/portal-backend/src/modules/providers/`、`apps/portal-backend/src/modules/models/`、`apps/portal-backend/src/modules/proxy/`（转发层）、`apps/portal-backend/src/common/crypto/`
- 前端：`apps/portal-frontend/src/features/providers/`、`apps/portal-frontend/src/features/models/`、`pages/providers.tsx`、`pages/models.tsx`
