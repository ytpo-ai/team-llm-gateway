# TENANT_AUTH_REQ-002 前端认证闭环

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/tenant_auth.md` |
| 所属 plan | `docs/plan/TENANT_AUTH_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/tenant-auth-frontend` |
| 状态 | `in-progress` |

## 2. 需求描述

### 背景
前端已有基础路由/布局/主题/登录页骨架，但登录页未对接后端认证接口，无认证状态管理与路由守卫。需补齐前端认证闭环。

### 目标
- 初始化/登录页对接后端 `register` / `login` 接口。
- 认证状态管理（Zustand）：access/refresh token 持久化 + 当前用户。
- 路由守卫：未登录跳转登录页；已登录访问受保护页面。
- refresh 自动续期：access 过期时用 refresh 换取新 access。

### 验收条件
- [ ] `pnpm --filter portal-frontend dev` 启动成功。
- [ ] `pnpm --filter portal-frontend build` 通过。
- [ ] 初始化/登录闭环可用：注册管理员 → 登录 → 进入受保护页面。
- [ ] 未登录访问受保护页面自动跳转登录页。
- [ ] access 过期自动 refresh 续期（或明确回退登录）。

## 3. 技术方案摘要
- Vite + React 19 + TS + Tailwind + shadcn/ui + React Router + TanStack Query + Zustand。
- 参考 `docs/plan/TENANT_AUTH_PLAN.md` §3 与后端接口契约（REQ-001）。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/TENANT_AUTH_REQ-002_DEVELOPMENT.md`（待补充） |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [ ] 待验收
- [ ] 已交付
