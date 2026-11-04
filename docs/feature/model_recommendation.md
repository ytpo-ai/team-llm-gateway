# 模型选型建议（model_recommendation）

## 1. 功能设计

### 目标
- 根据「模型能力 + 办公场景」给出一套模型选用方案（该场景用哪个模型、是否开缓存、是否降级到更便宜模型等），实现 Token 成本优化。
- 首期「静态推荐」：模型能力标签 + 办公场景模板 → 规则推荐（场景→模型映射 + 成本/缓存提示），不做 LLM 动态推理。
- 相对参考项目（New API/LiteLLM/Portkey）的核心差异化能力（§8、D-02）。

### 数据结构
- 无新增数据集合：办公场景为后端静态模板（`SCENARIOS` 常量），推荐结果实时计算。
- 依赖 `Model.capabilities`（能力标签）与 `Model.multiplier`（倍率）作为匹配与成本排序的单一事实来源（`docs/technical/db_schema/MODEL_PROVIDER_SCHEMA.MD`）。

### 核心逻辑
- 规范能力标签字典：`chat`/`code`/`reasoning`/`vision`/`writing`/`translation`/`summarization`/`long-context`。
- 8 个办公场景模板（日常对话/代码生成/代码审查/文档撰写/翻译/长文总结/数据分析/图像理解），每场景含必需/可选能力、缓存提示、成本建议、典型任务。
- 推荐引擎：团队 active 模型 → 必需能力全匹配候选 → 按 `multiplier` 升序（成本优先）→ 首选 + 替代；无全匹配时部分匹配兜底。

## 2. 需求追溯

| Plan | Requirement | Development | Fix |
|------|------------|-------------|-----|
| [MODEL_RECOMMENDATION](../plan/MODEL_RECOMMENDATION_PLAN.md) | [REQ-001 后端推荐引擎](../requirement/MODEL_RECOMMENDATION_REQ-001_BACKEND_RECOMMENDATION.md) | [开发记录](../development/MODEL_RECOMMENDATION_REQ-001_DEVELOPMENT.md) | — |
| 同上 | [REQ-002 前端选型建议页](../requirement/MODEL_RECOMMENDATION_REQ-002_FRONTEND_RECOMMENDATION.md) | [开发记录](../development/MODEL_RECOMMENDATION_REQ-002_DEVELOPMENT.md) | — |
| [TEAM_CONTEXT_SWITCH](../plan/TEAM_CONTEXT_SWITCH_PLAN.md) | [REQ-004 团队选择器与上下文切换](../requirement/TEAM_MEMBER_REQ-004_TEAM_SELECTOR.md) | [开发记录](../development/TEAM_MEMBER_REQ-004_DEVELOPMENT.md) | — |

## 3. 相关文档
- 技术文档：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（§8、D-02）、`docs/technical/db_schema/MODEL_PROVIDER_SCHEMA.MD`
- 规划文档：`docs/plan/MODEL_RECOMMENDATION_PLAN.md`

## 4. 相关代码文件
- 后端：`apps/portal-backend/src/modules/recommendation/`
- 前端：`apps/portal-frontend/src/features/recommendation/`、`pages/recommendation.tsx`
