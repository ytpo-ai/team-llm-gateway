# PROXY_POLICY_PROTOCOL_REQ-001 协议类型 + PolicyResolver

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/usage_metering.md`、`docs/feature/billing_quota.md` |
| 所属 plan | `docs/plan/PROXY_POLICY_PROTOCOL_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `main` |
| 状态 | `in-progress` |

## 2. 需求描述

### 背景
当前转发层策略解析与策略执行耦合在 `ProxyService` + `QuotaLimitService` 中，`ResolvedPolicyContext` 持有 Mongoose 文档，无法序列化、无法跨进程/跨语言。为后续四条扩展路径（标准协议 → 独立服务 → 多语言 → 分布式）铺路，需先将策略抽象为纯数据协议。

### 目标
1. 新增纯协议类型文件 `proxy/protocol/`：`StandardPolicy`、`StandardState`、`StandardLimit`、`StandardRequest`、`Candidate`、`StandardResult` + `Measure`/`Window`/`Action` 枚举，与 Nest/Mongoose 解耦。
2. 新增 `PolicyResolver` 服务：从 `QuotaLimitService` 抽取策略解析/合并逻辑，产出 `StandardPolicy`（states + allowlists + limits）与 `Candidate[]`。

### 验收条件
- [ ] 协议类型文件不 import 任何 Mongoose/Nest 类型
- [ ] `PolicyResolver` 单测覆盖三层合并（状态求值、白名单交集、限额扁平化、余额→`balance_ok`、模型禁用→`model_active`）
- [ ] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过

## 3. 技术方案摘要
- 协议类型落位 `apps/portal-backend/src/modules/proxy/protocol/`，定义：
  - 枚举：`Measure`、`Window`、`Action`
  - 接口：`StandardPolicy`、`StandardState`、`StandardLimit`、`StandardRequest`、`Candidate`、`StandardResult`
- `PolicyResolver` 落位 `apps/portal-backend/src/modules/proxy/policy-resolver.service.ts`：
  - 从 `QuotaLimitService.resolve` + `isModelAllowed`/`isProviderAllowed` + `resolveRateLimits` + `BillingService.getSpendableBalance` 的解析/合并逻辑重组而来
  - 职责：查三级策略集 → 求值状态（余额 `balance_ok`、模型禁用 `model_active` 等）→ 合并白名单交集 → 扁平化限额 → 产出 `StandardPolicy`
  - 同时产出 `Candidate[]`（按 priority 排序、过滤 disabled/exhausted 渠道、解密上游 key）
- 对应映射详见 `docs/technical/PROXY_POLICY_PROTOCOL.MD` §4 映射表

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/PROXY_POLICY_PROTOCOL_REQ-001_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [ ] 开发中
- [ ] 待验收
- [ ] 已交付