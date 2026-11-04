# TEAM_MEMBER_REQ-004 团队选择器与上下文切换

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/team_member.md`（主）、`docs/feature/billing_quota.md`、`docs/feature/usage_metering.md`、`docs/feature/model_provider.md`、`docs/feature/api_key.md`、`docs/feature/model_recommendation.md`、`docs/feature/portal_ui.md` |
| 所属 plan | `docs/plan/TEAM_CONTEXT_SWITCH_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/team-context-switch` |
| 状态 | `done` |

## 2. 需求描述

### 背景
租户下存在多个团队时，团队数据仍固定取登录时的 JWT `teamId`，`system` 管理员无法在界面切换查看不同团队的数据；前端三处团队取数口径不一致；计费接口对 `system` 返回全租户数据。

### 目标
- 导航栏新增团队选择器：`system` 且团队数 > 1 时显示，可切换当前团队。
- 除「系统管理」外的所有团队功能按当前选中团队展示数据（后端通过 `x-team-id` 请求头覆盖 `user.teamId`）。
- 「系统管理」分组（系统设置/额度管理/租户管理/全局看板）不随团队切换。
- 默认展示最先创建的团队；刷新后记住上次选择。

### 验收条件
- [ ] 后端 `jwt.strategy` 支持 `x-team-id` 覆盖：system 且团队属于租户时覆盖 `teamId`；非 system 忽略；无 header 回退 JWT 值。
- [ ] `billing.service` 的 `listAccounts`/`listTransactions` 对 system 也按 `user.teamId` 过滤。
- [ ] 前端 `system` 用户导航栏显示团队选择器（多团队时），默认选中最早团队，切换后各团队功能数据随之刷新。
- [ ] 前端 `team.tsx`/`api-keys.tsx`/`billing.tsx` 改用 `selectedTeamId`。
- [ ] `pnpm --filter portal-backend test/lint/typecheck`、`pnpm --filter portal-frontend typecheck/lint/build` 通过。

## 3. 技术方案摘要
- 后端：`jwt.strategy.ts` 开启 `passReqToCallback`，注入 `TeamsService`，读取 `x-team-id` 头覆盖 teamId；`TeamsService.findActiveTeamInTenant` 非抛错校验；`billing.service` 对 system 加 teamId 过滤。
- 前端：新增 `features/teams/store.ts`（zustand persist）；`lib/http.ts` 注入 `x-team-id`；`app-layout.tsx` 团队选择器 + 默认最早团队 + 切换全局失效；页面改用 `selectedTeamId`。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/TEAM_MEMBER_REQ-004_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
