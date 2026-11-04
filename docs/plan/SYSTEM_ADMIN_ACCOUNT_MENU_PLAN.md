# 系统管理员账号与菜单优化计划（SYSTEM_ADMIN_ACCOUNT_MENU）

> 本 plan 固化「系统管理员角色隔离 + 账号/菜单优化」的工程方案：系统管理员不再作为团队成员展示、系统管理员管理入口收敛到「系统管理」菜单、右上角新增修改密码并与退出登录折叠为用户菜单。
>
> - 需求来源：用户需求（系统管理员不应出现在团队/成员管理中；系统设置分组改名；右上角修改密码）
> - 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-06）、`docs/issue/团队管理功能的优化.md`（§3 系统管理员）
> - 定稿时间：2026-11-05
> - 状态：in-progress（进行中）

---

## 1. 需求背景

现有实现存在三处与「系统管理员」定位不符或体验缺失的问题：

1. **系统管理员出现在成员列表**：注册首个管理员时以 `role=system` 且 `teamId=默认团队` 写入 `User`，导致团队「成员管理」页把系统管理员当作团队成员展示（成员列表、成员计数、添加/移除均受影响）。按定稿结论「system 具备 team_admin 全部能力但不直接管团队」，系统管理员不应作为团队成员出现。
2. **系统管理员管理入口归组**：system 专属的「租户管理」「全局看板」目前挂在「系统设置」分组下，语义上与「系统管理员」不清晰，需将该分组改名为「系统管理」。
3. **账号操作缺失**：右上角仅有主题切换与退出登录两个图标，缺少「修改密码」入口，且退出登录裸露在顶栏。

## 2. 目标

1. 团队成员列表、成员计数排除系统管理员（`role=system`）。
2. 「系统设置」分组改名为「系统管理」，系统管理员管理入口（租户管理/全局看板）归入该分组。
3. 右上角新增「修改密码」：后端 `POST /auth/change-password`（校验旧密码、bcrypt 更新），前端弹窗承载。
4. 右上角「修改密码」「退出登录」折叠进用户下拉菜单（新增 `dropdown-menu` 原语）。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 成员隔离 | `TeamsService.listMembers` 过滤 `role === system` 的用户，不纳入成员视图；与 `admin.service` 现有 `role: { $ne: Role.SYSTEM }` 统计口径一致 |
| 修改密码 | 新增 `ChangePasswordDto`（oldPassword/newPassword，8~72 位）；`AuthService.changePassword` 校验旧密码（bcrypt.compare）后更新 `passwordHash`；`UsersService.UpdateUserInput` 增加 `passwordHash?` |
| 用户菜单 | 落地 `components/ui/dropdown-menu.tsx`（`@radix-ui/react-dropdown-menu`，shadcn new-york 风格）；顶栏用户菜单含「修改密码」「退出登录」，主题切换按钮保留独立 |
| 菜单改名 | `app-layout.tsx` 分组标题「系统设置」→「系统管理」（分组内「系统设置」页面项保持不变） |

## 4. Requirement 拆解

| Requirement | 内容 | 主要涉及 feature | 验收条件 |
|---|---|---|---|
| [REQ-003 账号与菜单优化](../requirement/SYSTEM_ADMIN_REQ-003_ACCOUNT_MENU.md) | 成员列表排除系统管理员、修改密码接口与弹窗、用户菜单折叠、系统设置分组改名 | system_admin（主）、team_member、tenant_auth、portal_ui | 成员页不显示系统管理员；修改密码可用；右上角用户菜单含修改密码/退出；分组显示「系统管理」；lint/typecheck/test 通过 |

## 5. 里程碑

1. ✅ 成员列表排除系统管理员（后端）。
2. ✅ 修改密码接口 + 前端弹窗 + 用户菜单折叠。
3. ✅ 系统设置分组改名「系统管理」。

## 6. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| T-01 | 无密码成员（`passwordHash=null`）不可登录，修改密码仅对已登录用户开放，后端对无密码账号返回明确错误 | 已覆盖 |
| R-01 | 新增前端依赖 `@radix-ui/react-dropdown-menu`，需 `pnpm install` | 已处理 |

## 7. 关联

- 上游：`docs/issue/团队管理功能的优化.md`、`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`
- feature：`docs/feature/system_admin.md`、`team_member.md`、`tenant_auth.md`、`portal_ui.md`
- requirement：见 §4
