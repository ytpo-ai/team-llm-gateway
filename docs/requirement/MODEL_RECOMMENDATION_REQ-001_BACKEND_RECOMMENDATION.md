# MODEL_RECOMMENDATION_REQ-001 后端推荐引擎

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/model_recommendation.md` |
| 所属 plan | `docs/plan/MODEL_RECOMMENDATION_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/model-recommendation-backend` |
| 状态 | `done` |

## 2. 需求描述

### 背景
`model_provider` 已交付 `Model.capabilities`（能力标签）与 `multiplier`（计费倍率）。现落地「模型选型建议」后端：内置规范能力标签字典与办公场景模板库，新增推荐引擎按「能力匹配 + 倍率成本排序」输出选用方案，实现 Token 成本优化（D-02、§8）。

### 目标
- 固化规范能力标签字典（`chat`/`code`/`reasoning`/`vision`/`writing`/`translation`/`summarization`/`long-context`）。
- 内置 8 个办公场景模板（静态常量 `src/modules/recommendation/scenarios.ts`）。
- 新增 `RecommendationService`：加载团队 active 模型 → 必需能力全匹配候选 → 按 `multiplier` 升序 → 首选 + 替代；无全匹配时部分匹配兜底。
- REST API：`GET /recommendations/scenarios`（场景列表）、`GET /recommendations/scenarios/:id`（场景详情 + 实时推荐），所有成员可读，团队隔离。
- 无新增数据集合，不新增 db_schema。

### 验收条件
- [x] `pnpm --filter portal-backend start:dev` 启动成功。
- [x] Swagger 可调 `GET /recommendations/scenarios` 返回 8 个场景模板。
- [x] `GET /recommendations/scenarios/:id` 对已知场景返回推荐（首选 + 替代 + 部分匹配 + 缓存/成本提示），对未知场景返回 404。
- [x] 推荐结果按「能力全匹配 + 倍率升序」排序，仅读取本团队 `status=active` 模型。
- [x] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过（含新增推荐引擎单测）。

## 3. 技术方案摘要
- 复用 Nest.js + Mongoose 既有模式（参考 `apps/portal-backend/src/modules/models/`）。
- 复用 `Model` schema（`../models/schemas/model.schema.js`）与 `ModelStatus.ACTIVE`。
- 推荐引擎与场景模板设计见 `docs/plan/MODEL_RECOMMENDATION_PLAN.md` §3。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/MODEL_RECOMMENDATION_REQ-001_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
