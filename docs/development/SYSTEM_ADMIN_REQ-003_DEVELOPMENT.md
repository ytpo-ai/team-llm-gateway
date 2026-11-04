# SYSTEM_ADMIN_REQ-003 开发记录（账号与菜单优化）

> 对应需求：`docs/requirement/SYSTEM_ADMIN_REQ-003_ACCOUNT_MENU.md`
> 对应计划：`docs/plan/SYSTEM_ADMIN_ACCOUNT_MENU_PLAN.md`
> 分支：`feat/system-admin-account-menu`

## 1. 实现摘要

1. 成员列表排除系统管理员：`TeamsService.listMembers` 过滤 `role === system` 的用户，避免系统管理员作为团队成员出现在「成员管理」页。
2. 修改密码：后端新增 `POST /auth/change-password`（校验旧密码 + bcrypt 更新）；前端新增修改密码弹窗，右上角「修改密码」「退出登录」折叠进用户下拉菜单。
3. 菜单改名：侧边栏「系统设置」分组改名「系统管理」，系统管理员管理入口（租户管理/全局看板）归入该分组。

## 2. 代码改动点

### 后端

| 文件 | 说明 |
|---|---|
| `modules/users/users.service.ts` | `UpdateUserInput` 增 `passwordHash?: string \| null` |
| `modules/teams/teams.service.ts` | `listMembers` 过滤 `role === Role.SYSTEM` |
| `modules/teams/teams.service.spec.ts` | 新增 `listMembers` 排除系统管理员用例 |
| `modules/auth/dto/change-password.dto.ts` | 新增 `ChangePasswordDto`（oldPassword/newPassword，8~72 位） |
| `modules/auth/auth.service.ts` | 新增 `changePassword(userId, dto)`：校验旧密码、bcrypt 更新 |
| `modules/auth/auth.controller.ts` | 新增 `POST /auth/change-password`（`JwtAuthGuard`） |
| `modules/auth/auth.service.spec.ts` | 新增 `changePassword` 4 条用例 |

### 前端

| 文件 | 说明 |
|---|---|
| `components/ui/dropdown-menu.tsx` | 新增 dropdown-menu 原语（`@radix-ui/react-dropdown-menu`，shadcn new-york 风格） |
| `features/auth/api.ts` | 新增 `changePassword` |
| `features/auth/components/change-password-dialog.tsx` | 新增修改密码弹窗（旧密码/新密码/确认新密码） |
| `components/layout/app-layout.tsx` | 分组「系统设置」→「系统管理」；右上角用户下拉菜单（修改密码 + 退出登录），主题切换保留独立 |

依赖：`apps/portal-frontend` 新增 `@radix-ui/react-dropdown-menu`。

## 3. 踩坑记录

1. **无密码成员**：`User.passwordHash` 可选，无密码成员不可登录，故修改密码入口仅对已登录用户开放；后端对 `passwordHash=null` 返回 `BadRequestException`（该账号未设置密码）。
2. **新密码边界**：DTO 沿用 `MinLength(8)/MaxLength(72)` 与登录/注册一致，避免 bcrypt 72 字节上限问题。

## 4. 验证结果

- 后端 `pnpm --filter portal-backend test`：201 passed。
- 后端 `pnpm --filter portal-backend typecheck` / `lint`：通过。
- 前端 `pnpm --filter portal-frontend typecheck` / `lint`（仅既有 2 warning）/ `build`：通过（2135 modules）。

## 5. 关联

- feature：`docs/feature/system_admin.md`（主）、`team_member.md`、`tenant_auth.md`、`portal_ui.md`
- 后端契约：`POST /auth/change-password`（`auth.controller.ts` → `auth.service.ts#changePassword`）
- 成员隔离口径：与 `admin.service` 现有 `role: { $ne: Role.SYSTEM }` 统计一致
