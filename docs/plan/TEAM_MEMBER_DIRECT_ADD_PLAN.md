# 团队成员直接添加优化计划（TEAM_MEMBER_DIRECT_ADD）

> 本 plan 固化「邀请成员改为直接添加成员（自动加入）」的工程方案。
>
> - 上游决策：`docs/technical/db_schema/TEAM_MEMBER_SCHEMA.MD`、`docs/technical/db_schema/TENANT_USER_SCHEMA.MD`
> - 上游 plan：`docs/plan/TEAM_MEMBER_PLAN.md`（已交付邀请制，本次改为直接添加）
> - 定稿时间：2026-11-04
> - 状态：done（已完成）

---

## 1. 需求背景

`team_member` 模块已交付两套成员加入方式：
- `POST /teams/:teamId/invitations`（邀请制）：管理员生成邀请链接，受邀者凭 token 注册后加入（`accept-invite`）。
- `POST /teams/:teamId/members`（直接添加）：后端已支持 email/name/role 直接创建成员，但前端未对接。

产品诉求：团队页「邀请成员」应改为「添加成员」——管理员填写 **邮箱 / 用户名(name) / 角色** 后**直接加入团队**（默认自动加入，无需对方接受），不再生成邀请链接。本期不做「生成默认 apikey」选项（已确认暂缓）。

## 2. 目标

1. 前端团队页「邀请成员」改为「添加成员」弹窗，字段为邮箱（必填）/ 用户名（必填）/ 角色（下拉，默认 `member`）。
2. 提交走既有 `POST /teams/:teamId/members`，成功后刷新成员列表，无需生成/复制邀请链接。
3. 移除前端邀请链接相关 UI 与封装（`createInvitation`/`listInvitations`/`revokeInvitation` 及 `Invitation`/`InvitationResult` 类型）。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 交互承载 | 弹窗（Dialog）：字段 ≤ 4，一次性决策（对应 `docs/rules/UI.md` §3 典型映射「邀请成员 → 弹窗」） |
| 接口复用 | 复用后端 `POST /teams/:teamId/members`（`CreateMemberDto` 已含 `name` 必填、`email` 可选、`role` 可选默认 `member`），后端无改动 |
| 前端封装 | `features/teams/api.ts` 新增 `createMember(teamId, { email, name, role })`；移除邀请相关函数与类型 |
| 状态刷新 | `useMutation` 成功后 `queryClient.invalidateQueries({ queryKey: ['members', team.id] })` |
| 残留处理 | 后端 `createInvitation`/`accept-invite`、前端 `invite.tsx` 页 + `/invite` 路由 + `useAuthStore.acceptInvite` 本期**保留为死代码**（避免波及既有测试与 auth 流程），后续单独清理 |

## 4. Requirement 拆解

| Requirement | 内容 | 主要涉及 feature | 验收条件 |
|---|---|---|---|
| [TEAM_MEMBER_REQ-003](../requirement/TEAM_MEMBER_REQ-003_FRONTEND_DIRECT_ADD.md) | 前端：添加成员弹窗（邮箱/用户名/角色）+ 对接 `createMember` + 移除邀请 UI | team_member | 管理员填表提交后成员直接出现在列表；lint/typecheck/build 通过 |

## 5. 里程碑

1. ✅ REQ-003 前端添加成员（本文档拆解）。

## 6. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| D-01 | 邀请链接相关残留代码（后端 invitation/accept-invite、前端 invite 页/路由/acceptInvite）是否删除 | 本期保留，后续清理 |
| D-02 | 添加成员时是否支持绑定角色B（`roleTemplateId`，即「使用角色」） | 本期仅三字段，`roleTemplateId` 仍可在成员列表行内编辑 |
| D-03 | 生成默认 apikey 选项 | 已确认暂缓，后续按需新增 |

## 7. 关联

- 上游：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`、`TEAM_MEMBER_PLAN.md`
- feature：`docs/feature/team_member.md`
- 数据模型：`docs/technical/db_schema/TEAM_MEMBER_SCHEMA.MD`、`TENANT_USER_SCHEMA.MD`
- requirement：见 §4
