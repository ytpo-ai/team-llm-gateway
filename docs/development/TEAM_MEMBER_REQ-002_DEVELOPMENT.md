# TEAM_MEMBER_REQ-002 开发记录（前端团队与成员管理）

> 对应需求：`docs/requirement/TEAM_MEMBER_REQ-002_FRONTEND_TEAM.md`
> 对应计划：`docs/plan/TEAM_MEMBER_PLAN.md`
> 分支：`feat/team-member-frontend`（提交 `706f1d6`）

## 1. 实现摘要

落地团队与成员管理前端界面，对接 REQ-001 后端接口，复用认证闭环（`features/auth` + `lib/http` 的 `request<T>`）：

- 团队管理页 `pages/team.tsx`：团队信息 + 成员列表（角色编辑/移除）+ 邀请（生成链接/复制/撤销）。
- 接受邀请页 `pages/invite.tsx`（公开路由）：填写姓名/密码后 `accept-invite` 并进入登录态。
- `features/teams`（types/api）：团队/成员/邀请接口封装与类型。
- 路由与导航：`/team`（受保护）与 `/invite`（公开）；导航栏接入「概览 / 团队」。
- auth 侧：`User` 类型补充 `teamId`；`useAuthStore` 新增 `acceptInvite` 动作；`acceptInvite` 接口归入 `features/auth/api.ts`（避免 `store → teams/api → http → store` 循环依赖）。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `features/teams/types.ts` | `Team` / `Member` / `Invitation` / `InvitationResult` + 角色标签与可分配角色 |
| `features/teams/api.ts` | `listTeams` / `listMembers` / `updateMember` / `removeMember` / `createInvitation` / `listInvitations` / `revokeInvitation` |
| `pages/team.tsx` | 团队与成员管理页（TanStack Query + 原生 select 角色编辑） |
| `pages/invite.tsx` | 接受邀请页 |

### 修改

| 文件 | 说明 |
|---|---|
| `features/auth/types.ts` | `User` 增加 `teamId: string \| null` |
| `features/auth/api.ts` | 新增 `acceptInvite` |
| `features/auth/store.ts` | 新增 `acceptInvite` 动作（复用 login/register 的持久化逻辑） |
| `router.tsx` | 新增 `/invite`（公开）与 `/team`（受保护）路由 |
| `components/layout/app-layout.tsx` | 导航栏接入「概览 / 团队」 |
| `modules/teams/teams.service.ts`（后端） | 团队/成员接口返回脱敏视图（`id` 而非 `_id`），随前端联调一并修正 |

## 3. 踩坑记录

1. **循环依赖风险**：初版把 `acceptInvite` 放在 `features/teams/api.ts`，而 `http.ts` 依赖 `auth/store`，形成 `store → teams/api → http → store` 环。因 `/auth/accept-invite` 属 auth 端点且返回 `AuthResponse`，将其归入 `features/auth/api.ts` 后消除新增环。
2. **团队接口 `_id` 与 `id` 不一致**：后端 `listTeams` 返回原始文档（`_id`），与成员/邀请的脱敏视图（`id`）不一致，已在 REQ-002 联调时统一为 `id`。

## 4. 验证结果

- `pnpm --filter portal-frontend lint`：0 errors（1 条 theme-provider 既有 warning，非本次改动）。
- `pnpm --filter portal-frontend typecheck`：通过。
- `pnpm --filter portal-frontend build`：通过（2029 modules，gzip 124.7 kB）。
- Vite 代理冒烟：`GET /invite?token=x`、`GET /` 返回 200；`GET /api/health` 转发成功；`POST /api/auth/register` 经代理返回 201。
- 后端接口闭环（REQ-001 冒烟）已覆盖「注册 → 邀请 → 接受 → 成员列表可见」，前端页面通过 React Query 对接同一契约。

## 5. 关联

- feature：`docs/feature/team_member.md`
- 后端契约：REQ-001（`docs/development/TEAM_MEMBER_REQ-001_DEVELOPMENT.md`）
- 待决事项：T-02（邀请邮件通知，首期仅复制链接）见 `docs/plan/TEAM_MEMBER_PLAN.md` §6。
