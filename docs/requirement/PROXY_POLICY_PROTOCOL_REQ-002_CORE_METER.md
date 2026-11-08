# PROXY_POLICY_PROTOCOL_REQ-002 ProxyCore 重构 + MeterBackend

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/usage_metering.md`、`docs/feature/billing_quota.md` |
| 所属 plan | `docs/plan/PROXY_POLICY_PROTOCOL_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `main` |
| 状态 | `done` |

## 2. 需求描述

### 背景
REQ-001 已落地协议类型与 `PolicyResolver`。本期重构转发核心，消费 `StandardRequest` + `StandardResult`，并引入 `MeterBackend` 抽象（Redis 计数）替代进程内 Map 内存态。

### 目标
1. 新增 `MeterBackend` 接口 + `RedisMeterBackend`（ioredis 计数），收口速率/并发/用量限额判断。
2. 重构 `ProxyService` 消费 `StandardRequest`（状态集判定 → 白名单 ∈ → 策略集计数 → 路由 fallback → 转发 → 计量）→ 产出 `StandardResult`。
3. 业务面消费 `StandardResult` 落 `UsageLog` + 扣费（`BillingService.deduct`），扣费最终一致（`requestId` 幂等 + 对账兜底）。

### 验收条件
- [ ] 转发回归：三协议（OpenAI/Anthropic/Gemini）、流式/非流式、多渠道 fallback、429 切换、计量扣费、余额 402 行为不变
- [ ] 现有 `proxy.service.spec.ts` 全部通过（或等价替换为 ProxyCore spec）
- [ ] MeterBackend 单测覆盖 checkLimit/increment/acquireConcurrency
- [ ] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过

## 3. 技术方案摘要
- `MeterBackend` 接口 + `RedisMeterBackend`（ioredis，`REDIS_URL`）
- ProxyCore 仍是 backend 进程内模块（Nest service），与 Resolver 同进程，但只依赖 Redis 计数 + fetch、不依赖 MongoDB
- `RateLimitService` / `ConcurrencyService` 逻辑收口进 `RedisMeterBackend`
- 用量限额判断由「查询 MongoDB 聚合」改为「Redis 计数」；`UsageLog`（MongoDB）仍由业务面落库
- 详细设计见 `docs/technical/PROXY_POLICY_PROTOCOL.MD` §3-§5

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/PROXY_POLICY_PROTOCOL_REQ-002_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付