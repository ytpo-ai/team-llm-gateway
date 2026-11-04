# 多团队选择器与团队上下文切换计划（TEAM_CONTEXT_SWITCH）

> 本 plan 固化「导航栏团队选择器 + 团队上下文切换」的工程方案：当租户下存在多个团队时，导航栏提供团队选择器，除「系统管理」外的所有以团队为基础的功能按当前选中团队展示数据，默认展示最先创建的团队。
>
> - 需求来源：用户需求（多团队下按选中团队展示数据）
> - 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-03/06 多租户/多团队定位）
> - 定稿时间：2026-11-05
> - 状态：done（已完成）

---

## 1. 需求背景

当前后端各团队实体（Model/Provider/ApiKey/RoleTemplate/PolicySet/QuotaAccount/QuotaTransaction/UsageLog/Recommendation/AuditLog）均已按 `{ tenantId, teamId }` 存储与查询，控制器统一通过 `@CurrentUser('teamId')` 取团队隔离。但该 `teamId` 来自 JWT payload（登录时固定），无法在会话内切换：

1. **无切换入口**：导航栏没有团队选择器，`system` 管理员虽可创建多个团队，却无法在界面切换查看不同团队的数据。
2. **前端团队取数不一致**：`pages/team.tsx` 硬编码 `listTeams()[0]`；`billing.tsx`/`quota-topup.tsx` 用 `listTeams` + `user.teamId` 回退；其余页面依赖后端 JWT `teamId`，三处口径不统一。
3. **计费接口的 system 全局视角**：`billing.service.listAccounts/listTransactions` 对 `system` 角色不加 `teamId` 过滤（返回全租户），与「团队功能按选中团队展示」不一致。

## 2. 目标

1. 导航栏新增团队选择器：`system` 角色且团队数 > 1 时显示，展示当前团队名称，可切换。
2. 除「系统管理」外的所有团队功能（成员/角色/策略/API Key/选型/渠道/模型/用量/审计/余额流水）按当前选中团队展示。
3. 「系统管理」分组（系统设置/额度管理/租户管理/全局看板）保持租户/系统级，不随团队切换。
4. 默认展示最先创建的团队（`listTeams` 按 `createdAt` 升序，取首个）；刷新后记住上次选择。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 团队覆盖机制 | JWT 策略支持请求头覆盖：`jwt.strategy.ts` 开启 `passReqToCallback`，`validate(req, payload)` 读取 `x-team-id`；仅 `system` 且团队属于当前租户时覆盖 `teamId`，非 system 一律忽略（防越权），无 header 时回退 JWT `teamId` |
| 团队校验 | `TeamsService` 新增非抛错的 `findActiveTeamInTenant(tenantId, teamId)`（`_id + tenantId` 查询） |
| 计费隔离 | `BillingService.listAccounts/listTransactions` 对 `system` 也按 `user.teamId` 过滤（原为全租户） |
| 前端上下文 | 新增 `features/teams/store.ts`（zustand + persist：`selectedTeamId`）；`lib/http.ts` 鉴权请求注入 `x-team-id` |
| 选择器与默认 | `app-layout.tsx` 拉取 `listTeams()`，渲染选择器（system 且多团队），初始化默认 `teams[0]`（最早），切换时 `queryClient.invalidateQueries()` |
| 页面取数统一 | `team.tsx` / `api-keys.tsx` / `billing.tsx` 改用 `selectedTeamId`（替代 `listTeams()[0]` 与 `user.teamId` 硬编码） |

## 4. Requirement 拆解

| Requirement | 内容 | 主要涉及 feature | 验收条件 |
|---|---|---|---|
| [TEAM_MEMBER_REQ-004 团队选择器与上下文切换](../requirement/TEAM_MEMBER_REQ-004_TEAM_SELECTOR.md) | 后端 header 覆盖 + 计费隔离；前端 store/选择器/请求头/页面取数 | team_member（主）、billing_quota、usage_metering、model_provider、api_key、model_recommendation、portal_ui | system 可切换团队，各团队功能数据随选中团队变化；系统管理不受影响；默认最早团队、刷新记住；后端 test/lint/typecheck、前端 typecheck/lint/build 通过 |

## 5. 里程碑

1. ✅ 后端：JWT 策略团队覆盖 + 计费接口按团队隔离 system。
2. ✅ 前端：团队上下文 store + 请求头注入 + 导航栏选择器 + 默认最早团队。
3. ✅ 前端：页面改用 selectedTeamId + 切换刷新。

## 6. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| D-01 | 「余额与流水」是否随选中团队切换 | 已确认：随选中团队切换（system 也只看当前团队） |
| D-02 | 团队选择是否持久化 | 已确认：记住上次选择，首次默认最早团队 |
| R-01 | `validate` 对 system 带 header 的请求多一次团队查询 | 已接受（单条 `_id+tenantId` 索引查询） |
| R-02 | 计费 system 由「全租户」改为「选中团队」属行为变更 | 已确认（见 D-01） |
| R-03 | 工作区可能存在并行编辑 | 改动前复核 `git status` |

## 7. 关联

- 上游：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-03/06）
- feature：`docs/feature/team_member.md`（主）、`billing_quota.md`、`usage_metering.md`、`model_provider.md`、`api_key.md`、`model_recommendation.md`、`portal_ui.md`
- requirement：见 §4
