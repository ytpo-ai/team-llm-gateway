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
`system`（服务商）可管理多个客户团队（租户），但团队数据固定取登录时的 JWT `tenantId`/`teamId`，无法在界面切换查看不同客户团队的数据；前端取数口径不统一；计费接口对 `system` 返回全租户数据。

> 领域澄清：本系统「租户 = 客户团队」，当前 1 租户 = 1 团队。故「团队选择器」=「客户团队（租户）选择器」，切换粒度为租户（并推导其默认团队）。

### 目标
- 导航栏新增客户团队选择器：`system` 且客户团队数 > 1 时显示，可切换当前客户团队。
- 除「系统管理」外的所有团队功能按当前选中客户团队展示数据（后端通过 `x-tenant-id` 请求头覆盖 `tenantId` + 推导 `teamId`）。
- 「系统管理」分组（系统设置/额度管理/租户管理/全局看板）不随切换。
- 默认展示最先创建的客户团队；刷新后记住上次选择。

### 验收条件
- [x] 后端 `jwt.strategy` 支持 `x-tenant-id` 覆盖：system 且租户存在时覆盖 `tenantId` 并推导其默认团队 `teamId`；非 system 忽略；无 header 回退 JWT 值。
- [x] `billing.service` 的 `listAccounts`/`listTransactions` 对 system 也按 `user.teamId` 过滤。
- [x] 前端 `system` 用户导航栏显示客户团队选择器（多客户团队时），默认选中最早客户团队，切换后各团队功能数据随之刷新。
- [x] 前端 `team.tsx`/`api-keys.tsx` 改用 `listTeams()[0]`；`billing.tsx` 由后端按 `user.teamId` 过滤。
- [x] `pnpm --filter portal-backend test/lint/typecheck`、`pnpm --filter portal-frontend typecheck/lint/build` 通过。

## 3. 技术方案摘要
- 后端：`jwt.strategy.ts` 开启 `passReqToCallback`，注入 `TenantService` + `TeamsService`，读取 `x-tenant-id` 头覆盖 `tenantId` 并推导 `teamId`；`TenantService.findByIdOrNull` / `TeamsService.findFirstTeamForTenantOrNull` 非抛错校验；`billing.service` 对 system 加 teamId 过滤。
- 前端：`features/teams/store.ts`（zustand persist，`selectedTenantId`）；`lib/http.ts` 注入 `X-Tenant-Id`；`app-layout.tsx` 拉取 `listTenants()` 渲染客户团队选择器 + 默认最早客户团队 + 切换全局失效；页面改用 `listTeams()[0]`。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/TEAM_MEMBER_REQ-004_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
