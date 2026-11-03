# API_KEY_REQ-002 前端 API Key 管理

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/api_key.md` |
| 所属 plan | `docs/plan/API_KEY_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/api-key-frontend` |
| 状态 | `done` |

## 2. 需求描述

### 背景
`API_KEY_REQ-001` 已交付后端 CRUD/轮换/RBAC。现落地前端 API Key 管理页：列表、创建一次性展示完整 key、吊销、轮换、编辑限制，接入路由与导航。

### 目标
- 新增 `features/api-keys/`（types、api）。
- 页面 `pages/api-keys.tsx`：列表（keyPrefix、状态、限制、过期、lastUsedAt）+ 创建弹窗（名称/白名单/速率/预算/过期）+ 一次性完整 key 展示与复制 + 吊销/轮换/编辑限制。
- 路由 `/api-keys` 与导航接入（`router.tsx`、`app-layout.tsx`）。
- RBAC 前端表现：普通成员仅见自己的 key；`team_admin` 可看全团队 key。

### 验收条件
- [x] `pnpm --filter portal-frontend dev` / `build` 通过。
- [x] 创建 → 展示完整 key → 复制 → 列表可见 → 吊销/轮换 → 编辑限制闭环可用。
- [x] 列表/详情不展示完整 key，仅展示 `keyPrefix`。

## 3. 技术方案摘要
- 复用 React + TypeScript + Tailwind + TanStack Query + Zustand 既有模式（参考 `apps/portal-frontend/src/features/teams/`、`pages/team.tsx`）。
- 数据契约见 `docs/technical/db_schema/API_KEY_SCHEMA.MD` §4。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/API_KEY_REQ-002_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
