# MODEL_RECOMMENDATION_REQ-001 开发记录（后端推荐引擎）

> 对应需求：`docs/requirement/MODEL_RECOMMENDATION_REQ-001_BACKEND_RECOMMENDATION.md`
> 对应计划：`docs/plan/MODEL_RECOMMENDATION_PLAN.md`
> 分支：`main`

## 1. 实现摘要

落地「模型选型建议」后端：规范能力标签字典 + 8 个办公场景模板（静态常量）+ 推荐引擎（能力匹配 + 倍率排序），闭环差异化能力 D-02（§8），为前端选型页（REQ-002）提供数据。

- 能力标签字典：`chat`/`code`/`reasoning`/`vision`/`writing`/`translation`/`summarization`/`long-context`（`CAPABILITY_LABELS`）。
- 场景模板 `SCENARIOS`：日常对话/代码生成/代码审查/文档撰写/翻译/长文总结/数据分析/图像理解，每场景含 `requiredCapabilities`/`optionalCapabilities`/`cacheHint`/`tips`/`examples`。
- `RecommendationService.recommend()`：加载团队 `status=active` 模型 → 必需能力全匹配候选 → 按 `multiplier` 升序（成本优先）→ 首选 + 替代；无全匹配时按命中数降序 + 倍率升序给 `partialMatches` 兜底。
- REST API：`GET /recommendations/scenarios`（场景列表）、`GET /recommendations/scenarios/:id`（场景详情 + 实时推荐），所有成员可读，团队隔离。
- 无新增数据集合，复用 `Model` schema（能力标签 + 倍率）。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `modules/recommendation/scenarios.ts` | `CAPABILITY_LABELS` + `ScenarioTemplate` + `SCENARIOS`（8 场景） |
| `modules/recommendation/recommendation.service.ts` | 场景列表 + 推荐引擎（匹配打分 + 倍率排序 + 兜底） |
| `modules/recommendation/recommendation.controller.ts` | `GET /recommendations/scenarios[/:id]` |
| `modules/recommendation/recommendation.module.ts` | 模块装配（forFeature `Model` + `AuthModule`） |
| `modules/recommendation/recommendation.service.spec.ts` | 单测（5 例） |

### 修改

| 文件 | 说明 |
|---|---|
| `app.module.ts` | 注册 `RecommendationModule` |

## 3. 踩坑记录

1. **`Model` 类型无 `_id` 声明**：schema 类 `Model` 不含 `_id` 字段，服务内需用 `HydratedDocument<Model>`（`ModelDocument`）作为 `Model<ModelDocument>` 与回调参数类型，才能访问 `model._id`，否则 `tsc --noEmit` 报 `TS2339`。
2. **无全匹配的降级语义**：产品口径为「推荐更便宜模型」，但同场景全匹配候选内「最便宜即首选」，故把「降级」落到 `partialMatches`（缺部分必需能力但命中主要能力），前端据此引导用户补充模型标签，避免首期无匹配时页面空置。
3. **场景静态 vs 落库取舍**：场景模板为通用办公场景（不随团队变化），首期用后端常量避免 DB 种子与团队隔离的复杂度；团队自定义场景留待后续（plan §7 R-02）。

## 4. 验证结果

- `pnpm --filter portal-backend lint`：0 errors / 0 warnings。
- `pnpm --filter portal-backend typecheck`：通过。
- `pnpm --filter portal-backend test`：66 passed（新增 recommendation 5）。
- `pnpm --filter portal-backend build`：通过。

## 5. 关联

- feature：`docs/feature/model_recommendation.md`
- 上游：`docs/plan/MODEL_RECOMMENDATION_PLAN.md` §3、`docs/technical/db_schema/MODEL_PROVIDER_SCHEMA.MD`（能力标签 + 倍率来源）
