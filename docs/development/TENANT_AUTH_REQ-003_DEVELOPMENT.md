# TENANT_AUTH_REQ-003 开发记录（系统初始化门控）

> 对应需求：`docs/requirement/TENANT_AUTH_REQ-003_INITIALIZATION_GATE.md`
> 对应计划：`docs/plan/TENANT_AUTH_INITIALIZATION_GATE_PLAN.md`
> 分支：main（提交 `367285a`）

## 1. 实现摘要

以「是否存在 `system` 角色用户」作为系统初始化标识，落地「未初始化可自注册初始化、初始化后拒绝」的门控：

1. 后端新增 `GET /auth/init-status` 公开接口，返回 `{ initialized }`。
2. `POST /auth/register` 先校验初始化状态，已初始化返回 `403`。
3. 前端登录页挂载时查询初始化状态：未初始化显示「初始化」标签并默认进入初始化表单，已初始化仅显示登录表单。

## 2. 代码改动点

### 后端

| 文件 | 说明 |
|---|---|
| `modules/users/users.service.ts` | 新增 `existsSystemUser()`（`User.exists({ role: Role.SYSTEM })`） |
| `modules/auth/auth.service.ts` | 新增 `isInitialized()`；`register()` 开头加门控，已初始化抛 `ForbiddenException` |
| `modules/auth/auth.controller.ts` | 新增 `GET /auth/init-status`（公开，无鉴权） |
| `modules/auth/auth.service.spec.ts` | 新增 register 已初始化 403 + `isInitialized` true/false 共 3 条用例 |

### 前端

| 文件 | 说明 |
|---|---|
| `features/auth/types.ts` | 新增 `InitStatus`（`{ initialized: boolean }`） |
| `features/auth/api.ts` | 新增 `getInitStatus()`（`auth: false`） |
| `pages/login.tsx` | 挂载查询初始化状态；`initialized === false` 才渲染「登录/初始化」切换标签 |

### 文档

| 文件 | 说明 |
|---|---|
| `docs/plan/TENANT_AUTH_INITIALIZATION_GATE_PLAN.md` | 新增计划文档 |
| `docs/requirement/TENANT_AUTH_REQ-003_INITIALIZATION_GATE.md` | 新增需求文档 |
| `docs/feature/tenant_auth.md` | 需求追溯表补 REQ-003 行；「租户初始化」描述更新 |
| `docs/guide/RBAC_PERMISSION.MD` | 认证段补 `init-status` + register 门控说明（另见提交 `750439c`） |

## 3. 踩坑记录

1. **初始化状态查询失败的处理**：前端 `getInitStatus()` 失败时默认视为「已初始化」（隐藏初始化入口），避免在网络/后端不可用时误暴露自注册入口。
2. **判定用 `Model.exists()` 而非 `findOne`**：`exists()` 返回布尔且更轻量，符合「只判断有无」的语义。
3. **存量数据即已初始化**：现有库已存在 `admin@limountain.dev`（`role=system`），上线即视为已初始化，`register` 会立即返回 403（符合预期，与 plan R-01/R-02 一致）。

## 4. 验证结果

- 后端 `pnpm --filter portal-backend test`：210 passed（新增 3 条）。
- 后端 `pnpm --filter portal-backend typecheck` / `lint`：通过。
- 前端 `pnpm --filter portal-frontend typecheck` / `lint`（仅既有 2 warning）：通过。

## 5. 关联

- feature：`docs/feature/tenant_auth.md`
- 后端契约：`GET /auth/init-status`（`auth.controller.ts` → `auth.service.ts#isInitialized` → `users.service.ts#existsSystemUser`）；`POST /auth/register` 门控（`auth.service.ts#register`）
- 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-03 多租户内建）
