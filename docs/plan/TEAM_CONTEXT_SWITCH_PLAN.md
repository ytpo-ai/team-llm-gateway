# 客户团队（租户）选择器与上下文切换计划（TEAM_CONTEXT_SWITCH）

> 本 plan 固化「导航栏客户团队选择器 + 上下文切换」的工程方案：`system`（服务商）角色可在多个客户团队（租户）之间切换，除「系统管理」外的所有团队功能按当前选中的客户团队展示数据，默认展示最先创建的客户团队。
>
> - 需求来源：用户需求（多客户团队下按选中团队展示数据）
> - 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-03/06 多租户/多团队定位）
> - 定稿时间：2026-11-05
> - 状态：done（已完成）

---

## 0. 领域模型澄清

本系统「租户（Tenant）＝ 客户团队」：`system`（服务商）通过 `GET /admin/tenants` 管理多个客户团队，每个租户创建时自动配一个默认团队（`DEFAULT_TEAM_NAME`），当前产品形态下 **1 租户 = 1 团队**。因此「团队选择器」实为「客户团队（租户）选择器」，切换的粒度是租户（同时推导其默认团队），而非「同租户内的多团队」。

> 说明：本 plan 初稿曾误将切换粒度理解为「同租户内多团队」，后经数据核对（数据库中 2 个团队分属 2 个租户）与架构文档确认（Portal 核心＝团队→成员→多 key，团队即租户），修正为「租户（客户团队）切换」。

## 1. 需求背景

1. **无切换入口**：`system`（服务商）可管理多个客户团队，但导航栏没有客户团队选择器，无法在界面切换查看不同客户团队的数据。
2. **数据隔离由 JWT 固定**：各业务实体（Model/Provider/ApiKey/PolicySet/Quota/Usage/Audit 等）按 `{ tenantId, teamId }` 隔离，而 `teamId`/`tenantId` 来自登录时签发的 JWT，会话内无法切换。
3. **计费接口的 system 全局视角**：`billing.service.listAccounts/listTransactions` 对 `system` 不加 `teamId` 过滤（返回全租户），与「按选中团队展示」不一致。

## 2. 目标

1. 导航栏新增客户团队选择器：`system` 且客户团队数 > 1 时显示，展示当前客户团队名称，可切换。
2. 除「系统管理」外的所有团队功能（成员/角色/策略/API Key/选型/渠道/模型/用量/审计/余额流水）按当前选中的客户团队展示。
3. 「系统管理」分组（系统设置/额度管理/租户管理/全局看板）保持服务商/系统级，不随切换。
4. 默认展示最先创建的客户团队；刷新后记住上次选择。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 租户覆盖机制 | JWT 策略支持请求头覆盖：`jwt.strategy.ts` 开启 `passReqToCallback`，`validate(req, payload)` 读取 `x-tenant-id`；仅 `system` 且租户存在时覆盖 `tenantId`，并推导该租户默认团队的 `teamId`；非 system 一律忽略（防越权），无 header 时回退 JWT 值 |
| 租户/团队校验 | `TenantService` 新增非抛错 `findByIdOrNull(id)`；`TeamsService` 新增非抛错 `findFirstTeamForTenantOrNull(tenantId)`（`tenantId` + `createdAt` 升序取首个） |
| 计费隔离 | `BillingService.listAccounts/listTransactions` 对 `system` 也按 `user.teamId` 过滤（原为全租户） |
| 前端上下文 | `features/teams/store.ts`（zustand + persist：`selectedTenantId`）；`lib/http.ts` 鉴权请求注入 `X-Tenant-Id` |
| 选择器与默认 | `app-layout.tsx` 拉取 `listTenants()`（admin API），渲染选择器（system 且多客户团队），初始化默认最早租户（`createdAt` 升序），切换时 `queryClient.invalidateQueries()` |
| 页面取数统一 | `team.tsx` / `api-keys.tsx` 改用 `listTeams()[0]`（后端按覆盖后的 `tenantId` 返回当前客户团队的默认团队）；`billing.tsx` 由后端按 `user.teamId` 过滤 |

## 4. Requirement 拆解

| Requirement | 内容 | 主要涉及 feature | 验收条件 |
|---|---|---|---|
| [TEAM_MEMBER_REQ-004 团队选择器与上下文切换](../requirement/TEAM_MEMBER_REQ-004_TEAM_SELECTOR.md) | 后端租户覆盖 + 计费隔离；前端 store/选择器/请求头/页面取数 | team_member（主）、billing_quota、usage_metering、model_provider、api_key、model_recommendation、portal_ui | system 可切换客户团队，各团队功能数据随选中客户团队变化；系统管理不受影响；默认最早客户团队、刷新记住；后端 test/lint/typecheck、前端 typecheck/lint/build 通过 |

## 5. 里程碑

1. ✅ 后端：JWT 策略租户覆盖（`x-tenant-id` → 覆盖 `tenantId` + 推导 `teamId`）+ 计费接口按团队隔离 system。
2. ✅ 前端：客户团队上下文 store + 请求头注入 + 导航栏选择器 + 默认最早客户团队。
3. ✅ 前端：页面改用 `listTeams()[0]` + 切换刷新。

## 6. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| D-01 | 「余额与流水」是否随选中团队切换 | 已确认：随选中客户团队切换（system 也只看当前客户团队） |
| D-02 | 选择是否持久化 | 已确认：记住上次选择，首次默认最早客户团队 |
| R-01 | `validate` 对 system 带 header 的请求多一次租户+团队查询 | 已接受（单条 `_id` 查询 + 单条 `tenantId` 查询） |
| R-02 | 计费 system 由「全租户」改为「选中客户团队」属行为变更 | 已确认（见 D-01） |
| R-03 | 切换粒度已由「同租户内多团队」修正为「租户（客户团队）」 | 已修正（见 §0） |

## 7. 关联

- 上游：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-03/06）
- feature：`docs/feature/team_member.md`（主）、`billing_quota.md`、`usage_metering.md`、`model_provider.md`、`api_key.md`、`model_recommendation.md`、`portal_ui.md`
- requirement：见 §4
