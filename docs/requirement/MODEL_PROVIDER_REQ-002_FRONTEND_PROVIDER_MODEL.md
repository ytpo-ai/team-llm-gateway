# MODEL_PROVIDER_REQ-002 前端模型与上游管理

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/model_provider.md` |
| 所属 plan | `docs/plan/MODEL_PROVIDER_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/model-provider-frontend` |
| 状态 | `done` |

## 2. 需求描述

### 背景
`MODEL_PROVIDER_REQ-001` 已交付后端 providers/models CRUD/RBAC/加密。现落地前端上游管理页与模型目录页，接入路由与导航。

### 目标
- 新增 `features/providers/`（types、api）、`features/models/`（types、api）。
- 页面 `pages/providers.tsx`：列表（名称、类型、baseUrl、apiKeyHint、状态）+ 创建/编辑弹窗（名称/类型/baseUrl/上游 key）+ 删除（软禁用）。
- 页面 `pages/models.tsx`：列表（modelId、展示名、倍率、能力标签、渠道、状态）+ 创建/编辑弹窗 + 删除。
- 路由 `/providers`、`/models` 与导航接入（`router.tsx`、`app-layout.tsx`）。
- 上游 key 前端仅输入/展示脱敏 hint，不回显明文。

### 验收条件
- [ ] `pnpm --filter portal-frontend dev` / `build` 通过。
- [ ] 上游渠道：创建 → 列表可见（脱敏 hint）→ 编辑（可换 key）→ 删除闭环可用。
- [ ] 模型目录：创建 → 列表可见 → 编辑（倍率/能力标签）→ 删除闭环可用。
- [ ] 非 `team_admin` 角色不展示渠道管理入口与写操作。

## 3. 技术方案摘要
- 复用 React + TypeScript + Tailwind + TanStack Query + Zustand 既有模式（参考 `apps/portal-frontend/src/features/api-keys/`、`pages/api-keys.tsx`）。
- 数据契约见 `docs/technical/db_schema/MODEL_PROVIDER_SCHEMA.MD` §5。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/MODEL_PROVIDER_REQ-002_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
