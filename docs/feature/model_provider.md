# 模型与上游（model_provider）

## 1. 功能设计

### 目标
- 上游接入：直连 LLM（OpenAI/Anthropic/…）、Gateway、任意第三方中转，统一 **OpenAI 兼容抽象**（§3 核心解耦原则）。
- 模型目录：可用模型清单 + 倍率 + 能力标签。
- 模型别名/映射。
- 落实 ADR-09「方案 A」：Portal 持团队上游 key，成员 key 由 Portal 签发并转发。

### 数据结构
- 待设计（上游 provider / 模型元数据 / 能力标签）。

### 核心逻辑
- 待设计（OpenAI 兼容转发层，D-05 接口契约）。

## 2. 需求追溯

| Plan | Requirement | Development | Fix |
|------|------------|-------------|-----|
| [PORTAL_FOUNDATION](../plan/PORTAL_FOUNDATION_PLAN.md) | — | — | — |

## 3. 相关文档
- 技术文档：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（§3、ADR-09、D-05）

## 4. 相关代码文件
- 后端：`apps/portal-backend/src/modules/provider/`、`model/`
- 前端：`apps/portal-frontend/src/features/provider/`
