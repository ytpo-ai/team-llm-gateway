# 模型选型建议模块开发计划（MODEL_RECOMMENDATION）

> 本 plan 固化 Portal 差异化能力 **模型选型建议（model_recommendation）** 的工程方案，落地 ADR-08「§8 差异化能力」与待决事项 D-02：根据「模型能力 + 办公场景」给出一套模型选用方案（用哪个模型、是否开缓存、是否降级到更便宜模型），实现 Token 成本优化。
>
> - 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（§8、D-02）
> - 上游 plan：`docs/plan/MODEL_PROVIDER_PLAN.md`（`Model.capabilities` 能力标签 + `multiplier` 倍率已交付，作为匹配与成本排序的单一事实来源）
> - 定稿时间：2026-10-29
> - 状态：已完成

---

## 1. 需求背景

`model_provider` 已交付：模型目录 `Model` 携带 `capabilities`（能力标签）与 `multiplier`（计费倍率）。但团队仍缺乏「用哪个模型」的主动指引。New API / LiteLLM / Portkey 均只有路由与计费，没有主动的选型建议（§8）。现落地「模型选型建议」模块：内置办公场景模板 + 规则推荐引擎，按能力标签匹配 + 倍率成本排序，输出首选模型与更便宜的降级方案，并给出缓存/成本提示。首期为**静态推荐**（规则匹配），不做 LLM 动态推理。

## 2. 目标

1. 固化一套**规范能力标签字典**（与 `Model.capabilities` 对齐），作为场景匹配的约定基础。
2. 内置**办公场景模板库**（静态常量，无需落库）：场景 id/名称/描述 + 必需/可选能力 + 缓存提示 + 成本优化建议 + 典型任务示例。
3. 新增**推荐引擎**：按团队 active 模型做能力匹配打分 + 倍率成本排序，输出首选模型 / 降级替代 / 部分匹配兜底。
4. REST API：`GET /recommendations/scenarios`（场景列表）+ `GET /recommendations/scenarios/:id`（场景详情 + 实时推荐），所有成员可读。
5. 前端：选型建议页 `/recommendation`（场景卡片 + 推荐方案展示 + 成本对比），导航接入。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 能力标签字典 | 规范标签：`chat`/`code`/`reasoning`/`vision`/`writing`/`translation`/`summarization`/`long-context`；场景匹配仅用这些规范标签 |
| 场景模板 | 后端静态常量 `src/modules/recommendation/scenarios.ts`（8 个办公场景），不落库、不随团队变化；团队自定义场景留待后续 |
| 推荐引擎 | `RecommendationService.recommend(tenantId, teamId, scenarioId)`：加载团队 active 模型 → 必需能力全匹配者为候选 → 按 `multiplier` 升序（更便宜优先）→ 首选 + 替代；无全匹配时给部分匹配兜底 |
| 成本提示 | 首选/替代按倍率对比；缓存建议（是否开缓存）为场景级静态 `cacheHint` |
| 团队隔离 | 仅读取本团队 `tenantId + teamId` 且 `status=active` 的模型，复用 `ModelsService` 的 `Model` schema |
| 鉴权 | 复用 `JwtAuthGuard` + `@CurrentUser()`；推荐为只读能力，所有成员可访问，无需 `RolesGuard` |
| 数据模型 | **无新增集合**（场景为静态模板，推荐结果实时计算）；不新增 db_schema |

## 4. RBAC 设计

| 资源 | 读 | 写 |
|---|---|---|
| `recommendations`（场景 + 推荐结果） | 所有成员（`member`/`finance`/`viewer`/`team_admin`） | 无（静态，无写操作） |

## 5. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [MODEL_RECOMMENDATION_REQ-001](../requirement/MODEL_RECOMMENDATION_REQ-001_BACKEND_RECOMMENDATION.md) | 后端：能力标签字典 + 场景模板库 + `RecommendationService` 推荐引擎 + controller API + 单测 | `start:dev` 启动，Swagger 可调 `GET /recommendations/scenarios` 与 `/scenarios/:id`，推荐按能力匹配 + 倍率排序，lint/typecheck/test 通过 |
| [MODEL_RECOMMENDATION_REQ-002](../requirement/MODEL_RECOMMENDATION_REQ-002_FRONTEND_RECOMMENDATION.md) | 前端：选型建议页 `/recommendation`（场景卡片 + 推荐方案 + 成本对比）+ 路由/导航接入 | `dev`/`build` 通过，场景列表可见，选中场景展示首选/降级方案与缓存/成本提示 |

## 6. 里程碑

1. ✅ REQ-001 后端推荐引擎（本文档拆解）。
2. ✅ REQ-002 前端选型建议页闭环。
3. ✅ D-02 选型建议详细设计闭环（`PORTAL_FOUNDATION_PLAN.md` §7 待决事项 D-02 → 已解决）。

## 7. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| R-01 | 能力标签目前为自由文本（无枚举约束），匹配依赖规范字典对齐 | 本 plan 固化字典；已在 `models` 页面用逗号分隔录入，团队录入需遵循字典（后续可加枚举校验） |
| R-02 | 场景模板静态内置，团队无法自定义 | 首期静态推荐，团队自定义场景留待后续（可演进为 DB `Scenario` 集合） |
| R-03 | 无能力标签匹配的模型不参与推荐 | 推荐结果返回 `partialMatches` 兜底提示，并在前端引导补充标签 |
| R-04 | 是否开缓存仅静态提示，实际缓存由 Gateway 承接 | Portal 仅提示，缓存实现归属 team-llm-proxy |

## 8. 关联

- 上游：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（§8、D-02）、`MODEL_PROVIDER_PLAN.md`、`docs/technical/db_schema/MODEL_PROVIDER_SCHEMA.MD`
- feature：`docs/feature/model_recommendation.md`
- requirement：见 §5
