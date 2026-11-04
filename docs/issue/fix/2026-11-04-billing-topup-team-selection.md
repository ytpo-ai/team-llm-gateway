# 修复：充值/调整额度弹窗无法选择团队

> 关联 feature：`docs/feature/billing_quota.md`
> 关联 requirement：`docs/requirement/BILLING_QUOTA_REQ-001_BACKEND_BILLING.md`、`docs/requirement/BILLING_QUOTA_REQ-003_FRONTEND_BILLING.md`
> 修复日期：2026-11-04

## 1. 问题现象

在「额度与计费」页，`system`（系统管理员/服务商）可管理租户内多个团队，但「充值 / 调整额度」弹窗的「目标账户」下拉只列出当前登录用户所在团队与成员，系统中已存在的其它团队无法被选中，导致无法对其它团队充值/调整额度。

## 2. 根因分析

1. 后端 `BillingService.listAccounts()` 硬编码按 `user.teamId` 过滤，`system` 也仅能读到本团队账户（`billing.service.ts`）。
2. `RechargeQuotaDto` / `AdjustQuotaDto` 仅接受 `userId`（成员）作为目标，缺少 `teamId` 字段，无法指定其它团队。
3. 前端弹窗仅渲染「团队账户 + 当前团队成员」，无团队选择器。
4. **存量账号角色错位（数据问题）**：注册接口在 REQ-003（`19552ca`，11-02）前创建 `team_admin`，之后才改为「首个注册者 → `system`」。存量首个注册账号（如 `admin@limountain.dev`，10-28 注册）仍为 `team_admin`，导致团队选择器（`isSystem` 门控）对其不显示。

## 3. 修复动作

### 后端（`apps/portal-backend/src/modules/billing/`）

- `dto/recharge-quota.dto.ts`、`dto/adjust-quota.dto.ts`：新增可选 `teamId`（`@IsMongoId`）。
- `billing.service.ts`：
  - 注入 `TeamModel`，新增 `resolveTargetTeamId()`：`teamId ?? user.teamId`；`system` 可跨团队（校验团队属于本租户），`team_admin` 仅限本团队（否则 `ForbiddenException`）。
  - `recharge`/`adjust` 按解析后的 `teamId` 解析账户并落流水（流水 `teamId` 使用目标团队）。
  - `listAccounts()`：`member` 仅本人、`team_admin` 本团队、`system` 全租户；视图新增 `teamId`/`teamName` 字段（`buildTeamNameMap()` 批量取团队名）。
- `billing.service.spec.ts`：新增 `system` 跨团队充值、`team_admin` 越权拦截、`system` 全团队列表三处用例。

### 前端（`apps/portal-frontend/src/`）

- `features/billing/types.ts`：`QuotaAccount` 增 `teamId`/`teamName`；`RechargeInput`/`AdjustInput` 增 `teamId?`。
- `pages/billing.tsx`：
  - 引入 `listTeams()`，`system` 弹窗新增「团队」选择器，切换团队时重置目标账户。
  - 「目标账户」按所选团队过滤成员；提交携带 `teamId`。
  - `system` 余额卡片遍历全部团队（含无账户团队显示 0）；成员卡片追加团队名。

### 数据修复（存量账号角色迁移）

- 将首个注册账号 `admin@limountain.dev` 由 `team_admin` 升级为 `system`（一次性 DB 更新）。
- 迁移后需**重新登录**以刷新 JWT 中的 `role`。
- 备注：REQ-003 注册角色变更未做存量迁移，其它环境若存在 11-02 前注册的「首个账号」需同步迁移（或补充幂等迁移脚本，本 fix 未新增）。

## 4. 验证结果

- `pnpm --filter portal-backend test`：23 文件 / 169 用例通过。
- `pnpm --filter portal-backend typecheck`、`lint`：通过。
- `pnpm --filter portal-frontend typecheck`、`lint`、`build`：通过。

## 5. 关联

- feature：`docs/feature/billing_quota.md`（需求追溯表已更新）
- 技术文档：`docs/technical/db_schema/BILLING_QUOTA_SCHEMA.MD` §5（契约补充 `teamId`）
