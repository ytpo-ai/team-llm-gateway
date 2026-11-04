# TEAM_MEMBER_REQ-003 开发记录（前端成员直接添加）

> 对应需求：`docs/requirement/TEAM_MEMBER_REQ-003_FRONTEND_DIRECT_ADD.md`
> 对应计划：`docs/plan/TEAM_MEMBER_DIRECT_ADD_PLAN.md`
> 分支：`feat/team-member-direct-add`

## 1. 实现摘要

将团队页「邀请成员」改为「添加成员」：管理员填写 邮箱 / 用户名(name) / 角色 后直接创建成员（复用后端 `POST /teams/:teamId/members`），不再生成邀请链接。移除前端邀请链接相关 UI 与封装。

## 2. 代码改动点

### 修改

| 文件 | 说明 |
|---|---|
| `features/teams/api.ts` | 新增 `createMember(teamId, { email, name, role })`；移除 `createInvitation` / `listInvitations` / `revokeInvitation` |
| `features/teams/types.ts` | 移除 `Invitation` / `InvitationResult` / `InvitationStatus` 类型 |
| `pages/team.tsx` | 「邀请成员」按钮/弹窗改为「添加成员」弹窗（邮箱/用户名/角色），走 `createMember`；移除「已发出的邀请」列表、邀请链接展示及对应 state/query/mutation |

后端无改动（`CreateMemberDto` 已支持 `name` 必填、`email` 可选、`role` 可选默认 `member`）。

## 3. 踩坑记录

1. **残留邀请链路**：后端 `createInvitation` / `accept-invite` 及前端 `invite.tsx` 页、`/invite` 路由、`useAuthStore.acceptInvite` 本期保留为死代码（避免波及 auth 流程与既有测试），后续单独清理（见 plan D-01）。

## 4. 验证结果

- `pnpm --filter portal-frontend lint`：0 errors（2 条既有 warning，非本次改动）。
- `pnpm --filter portal-frontend build`：通过（`tsc -b` + vite build，2126 modules）。

## 5. 关联

- feature：`docs/feature/team_member.md`
- 后端契约：`POST /teams/:teamId/members`（`teams.controller.ts` → `teams.service.ts#createMember`）
- 待决事项：D-01/D-02/D-03 见 `docs/plan/TEAM_MEMBER_DIRECT_ADD_PLAN.md` §6。
