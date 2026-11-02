# TEAM_MANAGEMENT_REQ-003 开发记录（系统管理员 + 菜单结构）

> 对应需求：`docs/requirement/TEAM_MANAGEMENT_REQ-003_SYSTEM_ADMIN_MENU.md`
> 对应计划：`docs/plan/TEAM_MANAGEMENT_OPTIMIZATION_PLAN.md`
> 分支：`main`（提交 `19552ca`）

## 1. 实现摘要

落地系统管理员能力（角色层级、建团队权限）与「使用日志」分页明细：

- 首个注册者改为系统管理员（`system`）；`resolveTeamId` 支持租户内 system 归属团队（全局超管无 teamId 仍返回 null）。
- `RolesGuard` 引入角色层级 `system > team_admin > member`，system 自动通过 team_admin 校验（软约束）。
- 创建团队端点收紧为仅 `system`（`@Roles(SYSTEM)`）。
- 新增 `GET /usage/logs` 请求级使用日志分页明细接口（按模型/状态/时间筛选）。
- 前端新增「使用日志」页 + 菜单，统一 system/team_admin 管理入口。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `modules/usage/dto/usage-log-query.dto.ts` | 使用日志分页/筛选入参（page/pageSize/from/to/userId/apiKeyId/modelId/status） |
| `frontend/src/pages/usage-logs.tsx` | 使用日志页（分页表格 + 筛选） |

### 修改

| 文件 | 说明 |
|---|---|
| `modules/auth/auth.service.ts` | `register` role → `SYSTEM`；`resolveTeamId` 支持租户内 system 的 `teamId` |
| `modules/auth/guards/roles.guard.ts` | 角色层级 `ROLE_RANK`（system 3 / team_admin 2 / member 1） |
| `modules/teams/teams.controller.ts` | `POST /teams` 收紧为 `@Roles(SYSTEM)` |
| `modules/usage/usage.service.ts` | 新增 `listLogs`（分页 + 团队/成员隔离）+ `toLogView` |
| `modules/usage/usage.controller.ts` | 新增 `GET /usage/logs` |
| `modules/auth/auth.service.spec.ts` | register 断言改为 `SYSTEM` |
| `modules/usage/usage.service.spec.ts` | 新增 listLogs 用例（2 例） |
| `frontend/src/features/usage/{api,types}.ts` | 新增 `getUsageLogs` 与 `UsageLog*` 类型 |
| `frontend/src/router.tsx`、`app-layout.tsx` | 新增「使用日志」路由与菜单；`isTeamManager` 统一 system/team_admin |
| `frontend/src/pages/models.tsx`、`providers.tsx` | `isAdmin` 兼容 system |

## 3. 踩坑记录

1. **system 双语义**：全局超管（`super-admin-bootstrap`，无 `tenantId`/`teamId`）与租户内系统管理员（register 创建，有 `teamId`）共用 `system` 角色。`resolveTeamId` 需区分：有 `teamId` 则归属团队、无则 null，避免破坏超管登录。
2. **角色层级用「等级」而非「枚举包含」**：`@Roles(TEAM_ADMIN)` 需让 system 通过、`@Roles(SYSTEM)` 不能让 team_admin 通过，用 `ROLE_RANK` 数值比较（`userRank >= requiredRank`）最直观。
3. **usage-logs 分页口径**：后端 `listLogs` 用 `page/pageSize`（非 offset），前端分页按钮据此计算 `hasNext = page*size < total`，与 `audit-logs`（offset 口径）不一致，注意区分。

## 4. 验证结果

- `pnpm --filter portal-backend lint`：0 errors / 0 warnings。
- `pnpm --filter portal-backend typecheck`：通过。
- `pnpm --filter portal-backend test`：98 passed。
- `pnpm --filter portal-frontend typecheck` / `build`：通过。

## 5. 关联

- feature：`docs/feature/system_admin.md`、`usage_metering.md`、`team_member.md`
- 数据模型：`docs/technical/db_schema/USAGE_METERING_SCHEMA.MD`（`UsageLog` 未变更，仅新增查询接口）
- 待决事项：软约束 UI 引导（system 不直接管团队）后续可强化。
