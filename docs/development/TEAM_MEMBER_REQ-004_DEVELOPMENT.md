# TEAM_MEMBER_REQ-004 开发记录（团队选择器与上下文切换）

> 对应需求：`docs/requirement/TEAM_MEMBER_REQ-004_TEAM_SELECTOR.md`
> 对应计划：`docs/plan/TEAM_CONTEXT_SWITCH_PLAN.md`
> 分支：`feat/team-context-switch`

## 1. 实现摘要

在导航栏新增团队选择器，使多团队租户下的 `system` 管理员可在会话内切换「当前团队」，除「系统管理」外的所有团队功能按选中团队展示数据；`system` 默认展示最先创建的团队，刷新后记住上次选择。

- 后端团队覆盖机制：`JwtStrategy` 开启 `passReqToCallback`，`validate(req, payload)` 读取请求头 `x-team-id`；仅 `system` 角色且团队属于当前租户时覆盖 `user.teamId`，非 `system` 一律忽略（防越权），无 header 时回退 JWT `teamId`。
- `TeamsService` 新增非抛错的 `findTeamInTenantOrNull(tenantId, teamId)`（`_id + tenantId` 单条查询）。
- 计费隔离：`BillingService.listAccounts/listTransactions` 对 `system` 也按 `user.teamId` 过滤（原为全租户视角，现已随选中团队）。
- 前端上下文：新增 `features/teams/store.ts`（zustand + persist：`selectedTeamId`）；`lib/http.ts` 鉴权请求统一注入 `X-Team-Id` 头。
- 导航栏选择器：`app-layout.tsx` 拉取 `listTeams()`，`system` 且团队数 > 1 时渲染选择器；默认选中最早团队；切换时 `queryClient.invalidateQueries()` 全局失效刷新。
- 页面取数统一：`team.tsx` / `api-keys.tsx` / `billing.tsx` 改用 `selectedTeamId`（替代 `listTeams()[0]` 与 `user.teamId` 硬编码）。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `modules/auth/strategies/jwt.strategy.spec.ts` | JwtStrategy 单测（4 例：无 header 回退 / system 覆盖 / 非 system 忽略 / 团队不存在回退） |
| `features/teams/store.ts` | `useTeamContextStore`（zustand + persist，key `portal-team-context`） |

### 修改

| 文件 | 说明 |
|---|---|
| `modules/auth/strategies/jwt.strategy.ts` | 构造注入 `TeamsService` + `passReqToCallback`；`validate` 按 `x-team-id` 覆盖 `teamId` |
| `modules/teams/teams.service.ts` | 新增 `findTeamInTenantOrNull`（非抛错，供策略校验） |
| `modules/billing/billing.service.ts` | `listAccounts`/`listTransactions` 对 `system` 也按 `user.teamId` 过滤 |
| `modules/billing/billing.service.spec.ts` | 两处 system 用例由「断言无 teamId」改为「断言 teamId」 |
| `lib/http.ts` | 鉴权请求注入 `X-Team-Id` 头（取 `useTeamContextStore.selectedTeamId`） |
| `components/layout/app-layout.tsx` | 团队选择器（system 且多团队）+ 默认最早团队 effect + 切换失效 |
| `pages/team.tsx` | `team` 由 `listTeams()[0]` 改为 `selectedTeamId` 匹配 |
| `pages/api-keys.tsx` | 成员下拉 `listMembers` 改用 `selectedTeamId` |
| `pages/billing.tsx` | 移除团队下拉/全租户映射，团队余额卡由后端按团队过滤后的 `teamAccounts` 直接渲染 |

## 3. 踩坑记录

1. **团队覆盖只能放在 `JwtStrategy.validate`**：`billing.module.ts`/`api-keys.module.ts` 不 import AuthModule，`JwtAuthGuard` 无构造依赖、可被 `@UseGuards` 直接实例化，无法给 guard 注入 `TeamsService`。因此覆盖逻辑放在 AuthModule 内的 `JwtStrategy`（可注入 `TeamsService`），而非给 guard 加依赖。
2. **请求头注入会作用于所有鉴权请求**：`listTeams()`、`listMembers(teamId)` 等也带 `X-Team-Id`，但后端这些端点按 `tenantId` 或路径参数 `teamId` 过滤，不读 `user.teamId`，且策略仅对 `system` 覆盖，故不影响非 system 用户与系统管理组。
3. **effect 依赖 `teams` 数组导致 exhaustive-deps 警告**：改用 `teamsQuery.data` 作为依赖并在此处解构，消除 Fast Refresh 之外的新警告。

## 4. 验证结果

- `pnpm --filter portal-backend test`：206 passed（含新增 4 例 JwtStrategy + 2 处 billing 断言调整）。
- `pnpm --filter portal-backend typecheck`：通过。
- `pnpm --filter portal-backend lint`：0 errors / 0 warnings。
- `pnpm --filter portal-frontend typecheck`：通过。
- `pnpm --filter portal-frontend lint`：仅 2 条既有 warning（`button.tsx`/`theme-provider.tsx` 的 only-export-components，与本次无关）。
- `pnpm --filter portal-frontend build`：通过。

## 5. 关联

- feature：`docs/feature/team_member.md`（主）、`billing_quota.md`、`usage_metering.md`、`model_provider.md`、`api_key.md`、`model_recommendation.md`、`portal_ui.md`
- 技术文档：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-03/06 多租户/多团队定位）
- 待决事项：见 `docs/plan/TEAM_CONTEXT_SWITCH_PLAN.md` §6（D-01/D-02 已确认）
