# TEAM_MEMBER_REQ-002 前端团队与成员管理

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/team_member.md` |
| 所属 plan | `docs/plan/TEAM_MEMBER_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/team-member-frontend` |
| 状态 | `draft` |

## 2. 需求描述

### 背景
前端已有认证闭环（`features/auth`）、路由守卫、布局与 `/api` 代理。需新增团队与成员管理界面，对接 REQ-001 后端接口。

### 目标
- 团队/成员管理页：成员列表（含角色/状态）、邀请成员（生成链接并复制）、成员角色编辑、禁用/移除。
- 接受邀请页 `/invite?token=...`（公开路由）：填写姓名/密码后接受邀请并进入登录态。
- 路由与导航接入；非 `team_admin` 隐藏管理入口。

### 验收条件
- [ ] `pnpm --filter portal-frontend dev` 启动成功。
- [ ] `pnpm --filter portal-frontend build` 通过。
- [ ] 邀请 → 打开链接 → 接受 → 成员列表可见的闭环可用。
- [ ] 角色编辑 / 禁用 / 移除操作可用；非管理员不可见管理入口。

## 3. 技术方案摘要
- 复用 `src/lib/http.ts`（`request<T>`）、Zustand `useAuthStore`、React Router、shadcn/ui、TanStack Query。
- 参考 `docs/plan/TEAM_MEMBER_PLAN.md` §3 与后端接口契约（REQ-001）。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/TEAM_MEMBER_REQ-002_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [ ] 开发中
- [ ] 待验收
- [ ] 已交付
