# 计费成员视图开发计划（BILLING_QUOTA_MEMBER_VIEW）

> 本 plan 固化「余额 + 流水」观察页的**成员级粒度对齐**：充值已支持给指定成员单独充值（成员账户），但观察页的流水无法追溯成员归属、余额分组不清晰，且 `listTransactions` 对 `system` 角色的过滤与 `listAccounts` 不一致（仅看自己团队）。
>
> - 上游决策：`docs/feature/billing_quota.md`（团队/成员两级额度账户）、`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-10）
> - 上游 plan：`docs/plan/BILLING_QUOTA_PLAN.md`（额度账户 + 扣费引擎）、`docs/plan/BILLING_QUOTA_MENU_SPLIT_PLAN.md`（观察页拆分）
> - 定稿时间：2026-11-04
> - 状态：已完成

---

## 1. 需求背景

上一 plan（MENU_SPLIT）已把「余额 + 流水」拆到观察页，但存在两处成员级粒度的缺口：

1. **流水无法追溯成员**：`listTransactions` 返回仅含 `userId`（ObjectId），前端流水表无「账户」列，成员级充值/扣减与团队级混在一起，无法区分。
2. **system 角色流水过滤不一致**：`listAccounts` 对 system 返回租户全量账户，但 `listTransactions` 对 system 走 `filter.teamId = user.teamId`（system 的 teamId 常为空/单团队），system 看不到全部团队的流水。
3. **余额分组不清晰**：成员余额卡片与团队余额混在一排。

## 2. 目标

1. `listTransactions` 返回补 `label`（成员名）与 `teamName`（团队名），供前端展示账户归属。
2. 修复 `listTransactions` 的 system 角色过滤：与 `listAccounts` 对齐，system 看租户全量流水。
3. 前端流水表新增「账户」列（团队 · 团队名 / 成员 · 成员名）；余额区按「团队余额 / 成员余额」分组。
4. 成员余额仅显示**有独立账户**的成员（不做「列全部成员」的交叉展示）。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 后端 enrich | `QuotaTransactionView` 增 `label`/`teamName`；`listTransactions` 对 `accountType==='member'` 的行按 `userId` 解析成员名，对所有行按 `teamId` 解析团队名（复用 `buildLabelMap`/`buildTeamNameMap`） |
| 后端过滤 | `listTransactions` 改为：`member` → `userId`；`team_admin` → `teamId`；`system` → 不按团队过滤（租户全量），与 `listAccounts` 一致 |
| 前端类型 | `QuotaTransaction` 增 `label`/`teamName` |
| 前端流水 | 流水表新增「账户」列：`accountType==='member'` 显示「成员 · {label ?? userId}」，否则「团队 · {teamName ?? '—'}」 |
| 前端余额 | 余额区拆「团队余额」「成员余额」两个分组（成员余额为空时不渲染该分组） |
| 影响面 | 后端 `billing.service` + 单测；前端 `pages/billing.tsx`/`features/billing/types.ts`；不改扣费引擎 |

## 4. RBAC 设计

| 资源 | 读 | 写 |
|---|---|---|
| 余额 + 流水（`/billing`） | `member`（仅本人）/`team_admin`（本团队）/`system`（全租户） | — |

## 5. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [BILLING_QUOTA_REQ-010](../requirement/BILLING_QUOTA_REQ-010_MEMBER_VIEW.md) | 后端：流水补 `label`/`teamName` + 修复 system 过滤；前端：流水「账户」列 + 余额分组 | 后端 typecheck/lint/test 通过；前端 typecheck/lint/build 通过；流水表区分团队/成员交易；system 可见租户全量流水 |

## 6. 里程碑

1. ✅ REQ-010 成员视图对齐（本文档拆解）。

## 7. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| C-01 | 成员余额范围 | 定稿：只显示有独立账户的成员（不列全部成员） |
| C-02 | 团队账户扣减的 `userId` | `deduct` 对团队账户也写入 `userId`（消费人），但「账户」列以 `accountType` 为准，不受影响 |
| C-03 | 影响范围 | 后端 + 前端，不改扣费引擎与数据模型 |

## 8. 关联

- 上游：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-10）、`docs/feature/billing_quota.md`
- feature：`docs/feature/billing_quota.md`
- requirement：见 §5
