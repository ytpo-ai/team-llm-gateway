# PORTAL_REQ-003 前端基础框架

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/tenant_auth.md`（登录页骨架）、`docs/feature/INDEX.md` |
| 所属 plan | `docs/plan/PORTAL_FOUNDATION_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/portal-frontend-base` |
| 状态 | `done` |

## 2. 需求描述

### 背景
建立 React 前端基础框架，作为所有业务页面的承载。

### 目标
- Vite + React 19 + TS + Tailwind CSS + shadcn/ui。
- React Router 路由骨架 + 基础布局（侧边栏/顶栏）。
- TanStack Query + Zustand 接入。
- 主题（light/dark）基础。
- 登录页骨架（对接后端 auth 接口占位）。

### 验收条件
- [x] `pnpm --filter frontend dev` 启动成功。
- [x] `pnpm --filter frontend build` 通过。
- [x] 路由/布局/登录页可访问，主题切换可用。

## 3. 技术方案摘要
- Vite + React Router + TanStack Query + Zustand + shadcn/ui + Tailwind。
- 参考 `docs/plan/PORTAL_FOUNDATION_PLAN.md` §3。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/PORTAL_REQ-003_DEVELOPMENT.md`（待补充） |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
