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
- OpenAI 兼容转发层（成员 key → Portal → 上游 key 转发，D-05）延迟到后续运行时，与 usage_metering 联动交付。

## 2. 需求追溯

| Plan | Requirement | Development | Fix |
|------|------------|-------------|-----|
| [MODEL_PROVIDER](../plan/MODEL_PROVIDER_PLAN.md) | [REQ-001 后端模型与上游](../requirement/MODEL_PROVIDER_REQ-001_BACKEND_PROVIDER_MODEL.md) | [开发记录](../development/MODEL_PROVIDER_REQ-001_DEVELOPMENT.md) | — |
| 同上 | [REQ-002 前端模型与上游管理](../requirement/MODEL_PROVIDER_REQ-002_FRONTEND_PROVIDER_MODEL.md) | [开发记录](../development/MODEL_PROVIDER_REQ-002_DEVELOPMENT.md) | — |

## 3. 相关文档
- 技术文档：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（§3、ADR-09/10、D-05）、`docs/technical/db_schema/MODEL_PROVIDER_SCHEMA.MD`
- 规划文档：`docs/plan/MODEL_PROVIDER_PLAN.md`
- 上游：`docs/plan/API_KEY_PLAN.md`

## 4. 相关代码文件
- 后端：`apps/portal-backend/src/modules/providers/`、`apps/portal-backend/src/modules/models/`、`apps/portal-backend/src/common/crypto/`
- 前端：`apps/portal-frontend/src/features/providers/`、`apps/portal-frontend/src/features/models/`、`pages/providers.tsx`、`pages/models.tsx`
