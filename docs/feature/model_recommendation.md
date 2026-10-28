# 模型选型建议（model_recommendation）

## 1. 功能设计

### 目标
- 根据「模型能力 + 办公场景」给出一套模型选用方案（该场景用哪个模型、是否开缓存、是否降级到更便宜模型等），实现 Token 成本优化。
- 首期「静态推荐」：模型能力标签 + 办公场景模板 → 规则推荐（场景→模型映射 + 成本/缓存提示），不做 LLM 动态推理。
- 相对参考项目（New API/LiteLLM/Portkey）的核心差异化能力（§8、D-02）。

### 数据结构
- 待设计（场景模板 / 模型能力标签 / 推荐规则）。

### 核心逻辑
- 待设计（推荐引擎，D-02）。

## 2. 需求追溯

| Plan | Requirement | Development | Fix |
|------|------------|-------------|-----|
| [PORTAL_FOUNDATION](../plan/PORTAL_FOUNDATION_PLAN.md) | — | — | — |

## 3. 相关文档
- 技术文档：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（§8、D-02）

## 4. 相关代码文件
- 后端：`apps/portal-backend/src/modules/recommendation/`
- 前端：`apps/portal-frontend/src/features/recommendation/`
