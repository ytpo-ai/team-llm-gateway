# BILLING_QUOTA_REQ-002 转发层限额联动

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/billing_quota.md` |
| 所属 plan | `docs/plan/BILLING_QUOTA_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/billing-quota-proxy` |
| 状态 | `done` |

## 2. 需求描述

### 背景
`proxy` 转发层已实现成员 key 鉴权 + 模型/上游解析 + SSE 透传 + 计量联动，但 `ApiKey.rateLimitPerMinute` / `maxTokens` 实时校验与额度扣费尚未闭环（USAGE_METERING U-01）。现落地转发层限额联动：转发前校验速率/预算/余额，转发后按实际成本扣减额度。

### 目标
- 新增 `RateLimitService`：内存滑动窗口计数，`rateLimitPerMinute` 超限返回 429。
- `maxTokens` 预算：转发前聚合 `UsageLog` 该 key 累计 token，超限返回 429。
- 额度余额预检：转发前 `BillingService` 解析有效账户余额，余额 ≤ 0 返回 402。
- 转发后扣减：计量落库后按 `cost = multiplier × totalTokens` 调用 `deduct()`，记 `deduction` 流水。

### 验收条件
- [x] 成员 key 超过 `rateLimitPerMinute` 被拒绝（429）。
- [x] 成员 key 累计 token 超过 `maxTokens` 被拒绝（429）。
- [x] 团队/成员额度余额 ≤ 0 时请求被拒绝（402）。
- [x] 成功请求按实际成本扣减额度并落流水。
- [x] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过。

## 3. 技术方案摘要
- 复用 `apps/portal-backend/src/modules/proxy/` 既有转发链路，在 `prepare()` 前插入预检、`recordUsage()` 后插入扣减。
- 速率限制为内存实现（单实例限制，见 plan B-02）；token 预算初期聚合（见 plan B-03）。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/BILLING_QUOTA_REQ-002_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
