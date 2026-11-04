# TEAM_MEMBER_REQ-004 开发记录（客户团队选择器与上下文切换）

> 对应需求：`docs/requirement/TEAM_MEMBER_REQ-004_TEAM_SELECTOR.md`
> 对应计划：`docs/plan/TEAM_CONTEXT_SWITCH_PLAN.md`
> 分支：`feat/team-context-switch`

## 1. 实现摘要

在导航栏新增**客户团队（租户）选择器**，使 `system`（服务商）角色可在多个客户团队之间切换；除「系统管理」外的所有团队功能按当前选中的客户团队展示数据，默认展示最先创建的客户团队，刷新后记住上次选择。

> **领域澄清（本次修正）**：本系统「租户（Tenant）＝ 客户团队」，`system`（服务商）通过 `GET /admin/tenants` 管理多个客户团队，每个租户创建时自动配一个默认团队，当前形态下 **1 租户 = 1 团队**。因此「团队选择器」的切换粒度是**租户（客户团队）**，而非「同租户内的多团队」。初版曾误做成 `x-team-id` 在同租户内切团队，后经数据库核对（2 个团队分属 2 个租户）与架构文档确认后修正为 `x-tenant-id` 切租户。

> **切换边界（后续明确）**：除「系统管理」分组外，其余页面都随选中客户团队切换；「系统管理」分组不随切换。具体——「系统设置」固定读 system 自己租户（不注入 `X-Tenant-Id`）；「额度管理」不跟随全局选择器、改用自身「团队」下拉（列出全部客户团队）跨租户充值/调整；「租户管理」「全局看板」天然全局。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `modules/auth/strategies/jwt.strategy.spec.ts` | JwtStrategy 单测（4 例：无 header 回退 / system 覆盖租户+团队 / 非 system 忽略 / 租户不存在回退） |
| `features/teams/store.ts` | `useTeamContextStore`（zustand + persist，key `portal-tenant-context`，字段 `selectedTenantId`） |
| `modules/admin/admin.controller.ts` | `GET /admin/teams`（system 专用，跨租户列全部团队） |
| `modules/admin/admin.service.ts` | `listAllTeams()`（按 `createdAt` 升序返回全部团队的 id/name/tenantId/status） |
| `features/admin/api.ts` + `types.ts` | `listAllTeams()` 前端 API + `AdminTeam` 类型 |

### 修改

| 文件 | 说明 |
|---|---|
| `modules/auth/strategies/jwt.strategy.ts` | 注入 `TenantService` + `TeamsService`；读取 `x-tenant-id`，system 且租户存在时覆盖 `tenantId` 并推导其默认团队 `teamId` |
| `modules/tenant/tenant.service.ts` | 新增非抛错 `findByIdOrNull(id)` |
| `modules/teams/teams.service.ts` | 新增非抛错 `findFirstTeamForTenantOrNull(tenantId)`；`listMembers` 改为 `(user, teamId)`，对 system 放开跨租户（按团队自身 `tenantId` 查询） |
| `modules/teams/teams.controller.ts` | `members` 改传完整 `@CurrentUser()`（含 role） |
| `modules/billing/billing.service.ts` | `listAccounts`/`listTransactions` 对 `system` 按 `user.teamId` 过滤；`recharge`/`adjust` 用 `resolveTargetTeam` 按 `teamId` 推导 `tenantId`（跨租户） |
| `modules/billing/billing.controller.ts` | 充值/调整审计日志改用目标团队 `result.tenantId`/`result.teamId` |
| `lib/http.ts` | 鉴权请求注入 `X-Tenant-Id` 头（取 `selectedTenantId`）；新增 `tenant` 选项，`tenant:false` 不注入 |
| `features/system/api.ts` | `listSettings`/`updateSettings` 固定 `tenant:false`；`getCurrency`/`updateCurrency` 支持按需传 `tenant` |
| `features/system/components/currency-settings-card.tsx` | 系统设置页货币卡 `tenant:false` + 独立 queryKey `['system','currency','own']` |
| `components/layout/app-layout.tsx` | 拉取 `listTenants()` 渲染客户团队选择器（system 且多客户团队）+ 默认最早租户 + 切换失效 |
| `pages/team.tsx` | `team` 由 `listTeams()[0]`（后端按覆盖后 `tenantId` 返回当前客户团队默认团队） |
| `pages/api-keys.tsx` | 成员下拉 `listMembers` 改用 `listTeams()[0].id` |
| `pages/billing.tsx` | 团队余额卡由后端按团队过滤后的 `teamAccounts` 直接渲染；`queryFn: () => getCurrency()` |
| `pages/quota-topup.tsx` | 团队下拉对 system 改用 `listAllTeams`（列全部客户团队，不依赖全局选择器） |

## 3. 踩坑记录

1. **切换粒度误判（本次修正核心）**：初版将「团队选择器」理解为「同租户内多团队切换」，用 `x-team-id` 在同租户内覆盖 `teamId`。但实际数据与架构文档均表明「租户＝客户团队、1 租户 = 1 团队」，同租户内不存在多团队，导致选择器永不显示。修正为 `x-tenant-id` 覆盖 `tenantId`，并推导该租户的默认团队 `teamId`。
2. **覆盖逻辑必须放在 `JwtStrategy.validate`**：`billing.module.ts`/`api-keys.module.ts` 不 import AuthModule，`JwtAuthGuard` 无构造依赖、可被 `@UseGuards` 直接实例化，无法给 guard 注入 `TenantService`/`TeamsService`。故覆盖逻辑放在 AuthModule 内的 `JwtStrategy`。
3. **覆盖 `tenantId` 后 `listTeams()` 自动跟随**：后端各业务实体按 `{ tenantId, teamId }` 隔离，`listTeams(tenantId)` 取 `@CurrentUser('tenantId')`（已被覆盖），因此前端只需 `listTeams()[0]` 即可拿到当前客户团队的默认团队，无需在页面额外维护团队 id。
4. **`app-layout.tsx` 依赖顺序**：`useQuery` 的 `enabled` 引用了后声明的 `isSystem`，需将 `isSystem`/`isTeamManager` 提前到 `useQuery` 之前定义。
5. **「系统设置」与「系统管理」的边界**：侧边栏分组历史上叫「系统设置」，后改名「系统管理」，其中一个子项仍叫「系统设置」，导致「哪些页面不切换」的口径容易混淆。最终明确为——整个「系统管理」分组（系统设置/额度管理/租户管理/全局看板）不切换；但「系统设置」通过「前端不注入 `X-Tenant-Id`」（`tenant:false`）实现，而「额度管理」通过「后端跨租户 + 前端列全部团队」实现，两者机制不同。
6. **额度管理「不切换」≠ 只能管自己租户**：额度充值是对客户团队的操作，若「额度管理」像「系统设置」那样只读 system 自己租户，服务商将无法给其他客户团队充值。因此额度管理改为「不跟随全局选择器 + 自带『团队』下拉列全部客户团队 + 充值/调整跨租户」：后端 `resolveTargetTeam` 按 `teamId` 推导 `tenantId`（不再依赖 `user.tenantId`），成员列表对 system 放开跨租户校验，审计日志改用目标团队 `tenantId/teamId`。

## 4. 验证结果

- `pnpm --filter portal-backend test`：207 passed（含 JwtStrategy 4 例 + `listMembers` 跨租户 1 例 + billing 充值/调整用例适配）。
- `pnpm --filter portal-backend typecheck`：通过。
- `pnpm --filter portal-backend lint`：0 errors / 0 warnings。
- `pnpm --filter portal-frontend typecheck`：通过。
- `pnpm --filter portal-frontend lint`：仅 2 条既有 warning（`button.tsx`/`theme-provider.tsx` 的 only-export-components，与本次无关）。
- `pnpm --filter portal-frontend build`：通过。
- 接口实测：`GET /admin/teams` 返回 2 个团队；跨租户查成员不再 404；跨租户充值成功且账户 `tenantId` 正确推导为先进开发租户。
- 数据库核对：2 个租户（`测试团队`/`先进开发`）各含 1 个团队；`system` 账号 `admin@limountain.dev` 归属 `测试团队` 租户，切换器将列出 2 个客户团队。

## 5. 关联

- feature：`docs/feature/team_member.md`（主）、`billing_quota.md`、`usage_metering.md`、`model_provider.md`、`api_key.md`、`model_recommendation.md`、`portal_ui.md`
- 技术文档：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-03/06）
- 待决事项：见 `docs/plan/TEAM_CONTEXT_SWITCH_PLAN.md` §6（D-01/D-02 已确认，R-03 已修正）
