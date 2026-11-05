# 系统初始化门控计划（TENANT_AUTH_INITIALIZATION_GATE）

> 本 plan 固化「系统初始化门控」方案：以「是否存在 `system` 角色用户」作为系统是否已初始化的判定标识；未初始化时开放自注册完成初始化，初始化后前端隐藏初始化 UI、后端拒绝再次初始化。
>
> - 需求来源：用户需求（系统设置初始化标识；未初始化可自注册初始化系统；初始化后前端不再展示初始化 UI、后端 API 不接受初始化）
> - 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-03 多租户内建）
> - 定稿时间：2026-11-05
> - 状态：in-progress（进行中）

---

## 1. 需求背景

当前 `POST /auth/register` 无条件创建 `role: system` 用户（`auth.service.ts`），任何能触达该接口的人都能注册出一个超级管理员，缺少「系统仅初始化一次」的门控。前端 `login.tsx` 始终展示「登录/初始化」双标签，初始化入口无状态感知。

## 2. 目标

1. 以「是否存在 `system` 角色用户」作为系统初始化标识。
2. 新增公开接口 `GET /auth/init-status` → `{ initialized: boolean }`。
3. `POST /auth/register` 增加门控：已初始化返回 `403 系统已初始化`。
4. 前端登录页：未初始化显示「初始化」入口，已初始化仅显示登录表单。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 初始化判定 | `UsersService.existsSystemUser()` = `User.exists({ role: Role.SYSTEM })`；`AuthService.isInitialized()` 委托之 |
| 门控 | `AuthService.register` 先 `isInitialized()`，为 `true` 抛 `ForbiddenException('系统已初始化，无法再次注册')` |
| 状态接口 | `AuthController` 新增 `@Get('init-status')`（公开、无鉴权）返回 `{ initialized }` |
| 前端 | `features/auth/api.ts` 增 `getInitStatus()`；`login.tsx` 挂载查询，`initialized === false` 才渲染「初始化」标签 |

## 4. Requirement 拆解

| Requirement | 内容 | 主要涉及 feature | 验收条件 |
|---|---|---|---|
| [REQ-003 初始化门控](../requirement/TENANT_AUTH_REQ-003_INITIALIZATION_GATE.md) | 初始化标识 + init-status 接口 + register 门控 + 前端初始化 UI 门控 | tenant_auth | 未初始化可注册且系统变已初始化；已初始化 register 返回 403、前端仅显示登录；lint/typecheck/test 通过 |

## 5. 里程碑

1. ✅ 后端：`existsSystemUser` + `isInitialized` + `GET /auth/init-status` + `register` 门控。
2. ✅ 前端：登录页初始化 UI 门控。
3. ✅ 测试 + 文档。

## 6. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| R-01 | 现有库已有 `admin@limountain.dev`（system）→ 上线即视为已初始化，`register` 被禁用（符合预期） | 已确认 |
| R-02 | `SUPER_ADMIN_EMAIL/PASSWORD` 预置 system 用户同样使系统「已初始化」 | 已确认 |
| T-01 | 是否需要在初始化状态接口上做防枚举/限流 | 暂不做 |

## 7. 关联

- 上游：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`
- feature：`docs/feature/tenant_auth.md`
- requirement：见 §4
