# TEAM_MEMBER_REQ-003 前端成员直接添加

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/team_member.md` |
| 所属 plan | `docs/plan/TEAM_MEMBER_DIRECT_ADD_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/team-member-direct-add` |
| 状态 | `done` |

## 2. 需求描述

### 背景
团队页现有「邀请成员」为邀请链接流程（生成 token → 对方 `accept-invite` 注册）。产品改为「添加成员」：管理员填表后成员**直接加入团队**，无需对方接受。后端 `POST /teams/:teamId/members`（`createMember`）已支持 `email/name/role`，仅需前端对接。

### 目标
- 团队页「邀请成员」按钮与弹窗改为「添加成员」，字段为 邮箱（必填）/ 用户名 name（必填）/ 角色（下拉，默认 `member`）。
- 提交走 `createMember`，成功后刷新成员列表并关闭弹窗。
- 移除前端邀请链接相关 UI 与封装（`createInvitation`/`listInvitations`/`revokeInvitation`、`Invitation`/`InvitationResult` 类型、邀请列表区块、邀请链接展示）。

### 验收条件
- [x] `pnpm --filter portal-frontend dev` 启动成功。
- [x] `pnpm --filter portal-frontend lint` 0 errors。
- [x] `pnpm --filter portal-frontend typecheck` 通过。
- [x] `pnpm --filter portal-frontend build` 通过。
- [x] 管理员填写 邮箱/用户名/角色 提交后，成员直接出现在成员列表（不再生成邀请链接）。

## 3. 技术方案摘要
- 复用 `src/lib/http.ts`（`request<T>`）、TanStack Query（`useMutation` + `invalidateQueries`）、shadcn/ui（`Dialog`/`Input`/`Select`）。
- 弹窗承载依据 `docs/rules/UI.md` §3（字段 ≤ 4，一次性决策）。
- 参考 `docs/plan/TEAM_MEMBER_DIRECT_ADD_PLAN.md` §3 与后端契约（`CreateMemberDto`）。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/TEAM_MEMBER_REQ-003_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
