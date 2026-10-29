# MODEL_RECOMMENDATION_REQ-002 前端选型建议页

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/model_recommendation.md` |
| 所属 plan | `docs/plan/MODEL_RECOMMENDATION_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/model-recommendation-frontend` |
| 状态 | `done` |

## 2. 需求描述

### 背景
后端推荐引擎（REQ-001）已交付场景模板 + 推荐 API。现落地前端选型建议页：展示办公场景卡片，选中场景后展示首选/降级方案与缓存/成本提示，接入路由与导航。

### 目标
- 新增 `features/recommendation/`（`types.ts` + `api.ts`）。
- 新增页面 `pages/recommendation.tsx`：场景列表（左）+ 推荐详情（右），展示首选模型、降级替代、部分匹配兜底、缓存提示、成本对比（倍率）、典型任务示例。
- 路由 `/recommendation` + 导航「选型建议」接入。
- 无写操作，纯只读展示。

### 验收条件
- [ ] `pnpm --filter portal-frontend dev` / `build` 通过。
- [ ] 导航可见「选型建议」，进入 `/recommendation` 展示 8 个场景。
- [ ] 选中场景展示首选/降级方案与缓存/成本提示；无匹配时展示空态引导补充模型标签。
- [ ] `pnpm --filter portal-frontend lint` / `typecheck` 通过。

## 3. 技术方案摘要
- 复用 TanStack Query + `request`（`@/lib/http`）+ shadcn/ui（`Card`/`Button`）既有模式（参考 `apps/portal-frontend/src/pages/models.tsx`）。
- 接口契约见 `docs/plan/MODEL_RECOMMENDATION_PLAN.md` §3。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/MODEL_RECOMMENDATION_REQ-002_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
