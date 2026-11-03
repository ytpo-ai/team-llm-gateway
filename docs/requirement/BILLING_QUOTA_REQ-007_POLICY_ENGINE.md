# BILLING_QUOTA_REQ-007 策略求值引擎

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/billing_quota.md` |
| 所属 plan | `docs/plan/BILLING_QUOTA_POLICY_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `main` |
| 状态 | `done` |

## 2. 需求描述

### 背景
REQ-006 已落地 `PolicySet` 数据模型与硬迁移。本期重构转发层求值：`QuotaLimitService`/`ProxyService.enforceLimits()` 由「逐固定字段校验」改为「通用策略求值」，支持 token/request/concurrency/spend × 窗口 × block/warn，三级取最严 AND，范围白名单逐级交集。

### 目标
- 重构 `QuotaLimitService`：`resolve()` 加载 Team/RoleTemplate/ApiKey 及其 `policySetId`，合并出「团队/角色/Key」三级生效策略。
- 策略求值：
  - **token**：窗口内聚合 `UsageLog.totalTokens` 与 `limit` 比对。
  - **spend**：窗口内聚合 `UsageLog.cost`（`= multiplier × totalTokens`，点数）与 `limit` 比对。
  - **request（minute）**：复用 `RateLimitService` 内存滑动窗口。
  - **request（长窗口）**：窗口内计数 `UsageLog` 记录数与 `limit` 比对。
  - **concurrency**：仅 apikey 级，转发层内存计数（进 +1、结束 -1），超限拒绝。
- 动作：`block` 超限返回 429；`warn` 本期记录事件（不阻断），通知通道 Phase 2。
- 合并：团队→角色→Key 三级逐级 AND；同主体「同 measure+window」多条取 min；范围限制（providerIds/modelWhitelist）逐级取交集。
- 替换 `ProxyService.enforceLimits()`：删除对旧字段（`maxTokens`/`limitDaily` 等）的直接引用，统一走策略求值；保留余额预检（`getSpendableBalance`）。

### 验收条件
- [ ] `pnpm --filter portal-backend start:dev` 启动成功。
- [ ] 团队/角色/Key 三级策略正确拦截：token（日/周/月/永久）、request（分钟/长窗口）、spend（点数）、concurrency（apikey 级）。
- [ ] `block` 超限返回 429；`warn` 记录事件但不阻断。
- [ ] 范围白名单（渠道/模型）逐级交集正确（非空白名单须包含目标）。
- [ ] 同 measure+window 多条取最严；跨级 AND。
- [ ] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过（含求值引擎单测）。

## 3. 技术方案摘要
- 求值引擎在 `apps/portal-backend/src/modules/billing/quota-limit.service.ts` 重构，聚合走 `UsageService`（复用现有 `sumTokens` 及新增 `sumCost`/`countRequests`）。
- concurrency 计数器置于 `proxy` 模块（单实例内存，同 `RateLimitService`）。
- 结构详见 `docs/plan/BILLING_QUOTA_POLICY_PLAN.md` §3 与 `docs/guide/LIMIT.md` §3~§5。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/BILLING_QUOTA_REQ-007_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
