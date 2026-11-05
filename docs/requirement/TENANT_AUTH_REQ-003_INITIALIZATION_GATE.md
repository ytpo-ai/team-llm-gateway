# TENANT_AUTH_REQ-003 初始化门控

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/tenant_auth.md` |
| 所属 plan | `docs/plan/TENANT_AUTH_INITIALIZATION_GATE_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/tenant-auth-init-gate` |
| 状态 | `in-review` |

## 2. 需求描述

### 背景

`POST /auth/register` 无条件创建 `role: system` 用户，任何能触达接口的人都能注册超级管理员；前端登录页始终展示「登录/初始化」双标签，初始化入口无状态感知。

### 目标

- 以「是否存在 `system` 角色用户」作为系统初始化标识。
- 新增公开接口 `GET /auth/init-status` → `{ initialized: boolean }`。
- `POST /auth/register` 增加门控：已初始化返回 `403`。
- 前端登录页：未初始化显示「初始化」入口，已初始化仅显示登录表单。

### 验收条件

- [ ] 未初始化：`GET /auth/init-status` 返回 `{ initialized: false }`；`register` 成功创建 system 用户后 `init-status` 变为 `true`。
- [ ] 已初始化：`POST /auth/register` 返回 403「系统已初始化」；`init-status` 返回 `true`。
- [ ] 前端：未初始化登录页显示「初始化」标签，已初始化仅显示登录表单。
- [ ] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过；`pnpm --filter portal-frontend lint` / `typecheck` 通过。

## 3. 技术方案摘要

- 初始化判定：`UsersService.existsSystemUser()`（`User.exists({ role: Role.SYSTEM })`），`AuthService.isInitialized()` 委托。
- 门控：`AuthService.register` 先 `isInitialized()`，为真抛 `ForbiddenException`。
- 状态接口：`AuthController` 新增 `@Get('init-status')`（公开）。
- 前端：`features/auth/api.ts` 增 `getInitStatus()`；`login.tsx` 挂载查询，`initialized === false` 才渲染「初始化」标签。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/TENANT_AUTH_REQ-003_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪

- [x] 开发中
- [ ] 待验收
- [ ] 已交付
