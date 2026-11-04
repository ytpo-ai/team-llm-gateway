# TEAM_MEMBER_REQ-004 开发记录（客户团队选择器与上下文切换）

> 对应需求：`docs/requirement/TEAM_MEMBER_REQ-004_TEAM_SELECTOR.md`
> 对应计划：`docs/plan/TEAM_CONTEXT_SWITCH_PLAN.md`
> 分支：`feat/team-context-switch`

## 1. 实现摘要

在导航栏新增**客户团队（租户）选择器**，使 `system`（服务商）角色可在多个客户团队之间切换；除「系统管理」外的所有团队功能按当前选中的客户团队展示数据，默认展示最先创建的客户团队，刷新后记住上次选择。

> **领域澄清（本次修正）**：本系统「租户（Tenant）＝ 客户团队」，`system`（服务商）通过 `GET /admin/tenants` 管理多个客户团队，每个租户创建时自动配一个默认团队，当前形态下 **1 租户 = 1 团队**。因此「团队选择器」的切换粒度是**租户（客户团队）**，而非「同租户内的多团队」。初版曾误做成 `x-team-id` 在同租户内切团队，后经数据库核对（2 个团队分属 2 个租户）与架构文档确认后修正为 `x-tenant-id` 切租户。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `modules/auth/strategies/jwt.strategy.spec.ts` | JwtStrategy 单测（4 例：无 header 回退 / system 覆盖租户+团队 / 非 system 忽略 / 租户不存在回退） |
| `features/teams/store.ts` | `useTeamContextStore`（zustand + persist，key `portal-tenant-context`，字段 `selectedTenantId`） |

### 修改

| 文件 | 说明 |
|---|---|
| `modules/auth/strategies/jwt.strategy.ts` | 注入 `TenantService` + `TeamsService`；读取 `x-tenant-id`，system 且租户存在时覆盖 `tenantId` 并推导其默认团队 `teamId` |
| `modules/tenant/tenant.service.ts` | 新增非抛错 `findByIdOrNull(id)` |
| `modules/teams/teams.service.ts` | 新增非抛错 `findFirstTeamForTenantOrNull(tenantId)`（`tenantId` + `createdAt` 升序首个） |
| `modules/billing/billing.service.ts` | `listAccounts`/`listTransactions` 对 `system` 也按 `user.teamId` 过滤 |
| `modules/billing/billing.service.spec.ts` | 两处 system 用例由「断言无 teamId」改为「断言 teamId」 |
| `lib/http.ts` | 鉴权请求注入 `X-Tenant-Id` 头（取 `selectedTenantId`） |
| `components/layout/app-layout.tsx` | 拉取 `listTenants()` 渲染客户团队选择器（system 且多客户团队）+ 默认最早租户 + 切换失效 |
| `pages/team.tsx` | `team` 由 `listTeams()[0]`（后端按覆盖后 `tenantId` 返回当前客户团队默认团队） |
| `pages/api-keys.tsx` | 成员下拉 `listMembers` 改用 `listTeams()[0].id` |
| `pages/billing.tsx` | 团队余额卡由后端按团队过滤后的 `teamAccounts` 直接渲染（无前端团队 id） |

## 3. 踩坑记录

1. **切换粒度误判（本次修正核心）**：初版将「团队选择器」理解为「同租户内多团队切换」，用 `x-team-id` 在同租户内覆盖 `teamId`。但实际数据与架构文档均表明「租户＝客户团队、1 租户 = 1 团队」，同租户内不存在多团队，导致选择器永不显示。修正为 `x-tenant-id` 覆盖 `tenantId`，并推导该租户的默认团队 `teamId`。
2. **覆盖逻辑必须放在 `JwtStrategy.validate`**：`billing.module.ts`/`api-keys.module.ts` 不 import AuthModule，`JwtAuthGuard` 无构造依赖、可被 `@UseGuards` 直接实例化，无法给 guard 注入 `TenantService`/`TeamsService`。故覆盖逻辑放在 AuthModule 内的 `JwtStrategy`。
3. **覆盖 `tenantId` 后 `listTeams()` 自动跟随**：后端各业务实体按 `{ tenantId, teamId }` 隔离，`listTeams(tenantId)` 取 `@CurrentUser('tenantId')`（已被覆盖），因此前端只需 `listTeams()[0]` 即可拿到当前客户团队的默认团队，无需在页面额外维护团队 id。
4. **`app-layout.tsx` 依赖顺序**：`useQuery` 的 `enabled` 引用了后声明的 `isSystem`，需将 `isSystem`/`isTeamManager` 提前到 `useQuery` 之前定义。

## 4. 验证结果

- `pnpm --filter portal-backend test`：206 passed（含 JwtStrategy 4 例 + billing 2 处断言调整）。
- `pnpm --filter portal-backend typecheck`：通过。
- `pnpm --filter portal-backend lint`：0 errors / 0 warnings。
- `pnpm --filter portal-frontend typecheck`：通过。
- `pnpm --filter portal-frontend lint`：仅 2 条既有 warning（`button.tsx`/`theme-provider.tsx` 的 only-export-components，与本次无关）。
- `pnpm --filter portal-frontend build`：通过。
- 数据库核对：2 个租户（`测试团队`/`先进开发`）各含 1 个团队；`system` 账号 `admin@limountain.dev` 归属 `测试团队` 租户，切换器将列出 2 个客户团队。

## 5. 关联

- feature：`docs/feature/team_member.md`（主）、`billing_quota.md`、`usage_metering.md`、`model_provider.md`、`api_key.md`、`model_recommendation.md`、`portal_ui.md`
- 技术文档：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-03/06）
- 待决事项：见 `docs/plan/TEAM_CONTEXT_SWITCH_PLAN.md` §6（D-01/D-02 已确认，R-03 已修正）
