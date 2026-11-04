# SYSTEM_ADMIN_REQ-003 账号与菜单优化

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/system_admin.md`（主）、`docs/feature/team_member.md`、`docs/feature/tenant_auth.md`、`docs/feature/portal_ui.md` |
| 所属 plan | `docs/plan/SYSTEM_ADMIN_ACCOUNT_MENU_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/system-admin-account-menu` |
| 状态 | `in-progress` |

## 2. 需求描述

### 背景
系统管理员（`system`）在单团队自部署模式下不应作为团队成员出现；其管理入口应清晰归入「系统管理」菜单；账号侧缺少修改密码能力，且退出登录裸露在顶栏。

### 目标
- 团队成员列表与成员计数排除系统管理员（`role=system`）。
- 「系统设置」分组改名为「系统管理」，系统管理员管理入口（租户管理/全局看板）归入该分组。
- 新增 `POST /auth/change-password`：校验旧密码，更新新密码（bcrypt）。
- 右上角新增「修改密码」入口，并与「退出登录」折叠进用户下拉菜单。

### 验收条件
- [ ] 团队「成员管理」页不再显示系统管理员，成员计数不含系统管理员。
- [ ] `POST /auth/change-password` 校验旧密码，密码错误返回 401，成功更新密码后可重新登录。
- [ ] 右上角用户菜单包含「修改密码」「退出登录」，修改密码弹窗可用。
- [ ] 侧边栏分组显示「系统管理」。
- [ ] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过；`pnpm --filter portal-frontend lint` / `build` 通过。

## 3. 技术方案摘要
- 成员隔离：`TeamsService.listMembers` 过滤 `role === system`。
- 修改密码：`ChangePasswordDto` + `AuthService.changePassword` + `UsersService.UpdateUserInput.passwordHash`。
- 用户菜单：新增 `components/ui/dropdown-menu.tsx`（Radix），改造 `app-layout.tsx` 顶栏。
- 菜单改名：`app-layout.tsx` 分组标题。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/SYSTEM_ADMIN_REQ-003_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [ ] 待验收
- [ ] 已交付
