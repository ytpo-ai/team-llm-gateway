# MODEL_RECOMMENDATION_REQ-002 开发记录（前端选型建议页）

> 对应需求：`docs/requirement/MODEL_RECOMMENDATION_REQ-002_FRONTEND_RECOMMENDATION.md`
> 对应计划：`docs/plan/MODEL_RECOMMENDATION_PLAN.md`
> 分支：`main`

## 1. 实现摘要

落地前端选型建议页：办公场景列表（左）+ 推荐详情（右），展示首选/降级替代/部分匹配 + 缓存/成本提示，路由 `/recommendation` + 导航接入。

- `features/recommendation/`（`types` + `api`）：场景/推荐类型与 `GET /recommendations/scenarios[/:id]` API 封装。
- `pages/recommendation.tsx`：两栏布局——左侧场景列表，右侧推荐详情（首选模型高亮 + 更贵替代 + 部分匹配兜底 + 缓存提示 + 成本优化建议 + 典型任务）；无匹配时空态引导补充模型标签。
- 能力标签中文化映射（`CAPABILITY_LABELS`）与 `ModelCard`（倍率展示）本地实现。
- 路由 `/recommendation` + `app-layout` 导航「选型建议」接入。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `features/recommendation/types.ts` | `Scenario`/`ModelRef`/`Recommendation` 类型 |
| `features/recommendation/api.ts` | `listScenarios` / `getRecommendation` API |
| `pages/recommendation.tsx` | 选型建议页 |

### 修改

| 文件 | 说明 |
|---|---|
| `router.tsx` | 新增 `/recommendation` 路由 |
| `components/layout/app-layout.tsx` | 导航接入「选型建议」 |

## 3. 踩坑记录

1. **避免 effect 内同步 setState**：默认选中首场景原用 `useEffect` 同步赋值，触发 `react-hooks(set-state-in-effect)` 与 `exhaustive-deps` 两个 lint 警告；改为渲染期派生 `activeScenario = find(selectedId) ?? scenarios[0]`，彻底移除 effect，保留受控选中态。
2. **无 select/多选组件**：能力标签、典型任务均用 `span` + Tailwind 手绘标签，复用 `Card`/`cn` 既有组件，与 `models.tsx` 风格保持一致。

## 4. 验证结果

- `pnpm --filter portal-frontend typecheck`：通过。
- `pnpm --filter portal-frontend lint`：0 errors（1 条既有 warning，非本模块）。
- `pnpm --filter portal-frontend build`：通过。

## 5. 关联

- feature：`docs/feature/model_recommendation.md`
- 上游：`docs/plan/MODEL_RECOMMENDATION_PLAN.md` §3
