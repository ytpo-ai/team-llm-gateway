# 中转核心策略协议标准化（PROXY_POLICY_PROTOCOL）

> 本 plan 将转发核心（`ProxyService`）重构为符合 `docs/technical/PROXY_POLICY_PROTOCOL.MD` 定义的协议，实现 PolicyResolver / ProxyCore 职责分离、三层判定（状态集/白名单/策略集）与 MeterBackend 抽象（基础版内存实现）。**纯后端重构，转发行为保持不变。**
>
> - 上游决策：`docs/technical/PROXY_POLICY_PROTOCOL.MD`（v1 已定稿）
> - feature：`docs/feature/usage_metering.md`（主，proxy 转发层）、`docs/feature/billing_quota.md`（策略集/限额解析）
> - 定稿时间：2026-11-07
> - 状态：`draft`（草稿，待审批，暂不执行开发）

---

## 1. 需求背景

当前转发层逻辑集中在 `ProxyService`（`proxy.service.ts`），策略解析与策略执行耦合：

- `ResolvedPolicyContext` 持有 `PolicySetDocument`（Mongoose 文档），策略无法序列化、跨进程/跨语言。
- `QuotaLimitService` 同时承担策略解析（`resolve`）与策略执行（`assertUsageLimits`），职责未分离。
- 余额、租户/团队/key 状态等「外部值判断」与「量化限额」混在 `enforceLimits` 里，语义不分层。
- `RateLimitService` / `ConcurrencyService` 为进程内 `Map` 内存态，是分布式化（路径 4）的死穴。

为后续四条扩展路径（标准协议 → 独立服务 → 多语言 → 分布式）铺路，需先将「策略」抽象为纯数据协议，使中转核心无状态、输入输出自包含、实现可替换。

> 详细设计与设计意图（DR-01~DR-10）见 `docs/technical/PROXY_POLICY_PROTOCOL.MD`。

## 2. 目标

1. 定义协议类型（`StandardPolicy` / `StandardRequest` / `StandardResult` + 枚举），与 Nest / Mongoose 解耦。
2. 抽取 `PolicyResolver`：三级策略集合并 → 产出 `StandardPolicy`（states + allowlists + limits）与 `Candidate[]`。
3. 重构 `ProxyCore`：消费 `StandardRequest`，执行三层判定 → 路由 → 转发 → 计量，产出 `StandardResult`。
4. 抽取 `MeterBackend` 接口 + `MemoryMeterBackend`（复刻现有行为），为路径 4 的 `RedisMeterBackend` 预留接缝。
5. **约束：重构前后转发行为完全一致**（协议、流式、fallback、计量、扣费均不回归）。

## 3. 技术方案要点

引用 `docs/technical/PROXY_POLICY_PROTOCOL.MD`，落地要点如下：

### 3.1 协议类型落位

- 新增纯协议类型文件（建议 `apps/portal-backend/src/modules/proxy/protocol/`）：`StandardPolicy`、`StandardState`、`StandardLimit`、`StandardRequest`、`StandardResult` + `Measure` / `Window` / `Action` 枚举。
- 不依赖 Nest 装饰器、Mongoose 文档，仅纯 TS 类型 + 常量。

### 3.2 PolicyResolver（业务面，留在 Portal）

- 由现有 `QuotaLimitService.resolve` + `isModelAllowed`/`isProviderAllowed` + `resolveRateLimits` + `BillingService.getSpendableBalance` 的「解析/合并」逻辑重组而来。
- 职责：查三级策略集 → 求值状态（余额 `balance_ok`、模型禁用 `model_active` 等）→ 合并白名单交集 → 扁平化限额 → 产出 `StandardPolicy`；同时产出 `Candidate[]`（按 priority 排序、过滤 disabled/exhausted 渠道、解密上游 key）。
- 对应映射见 technical 文档 §4 映射表。

### 3.3 ProxyCore（数据面）

- 消费 `StandardRequest`：状态集判定（block/warn）→ 白名单 ∈ → 策略集计数 → 多渠道 fallback → 转发 → 计量 → 产出 `StandardResult`。
- 业务面消费 `StandardResult` 落 `UsageLog` + 扣费（`BillingService.deduct`）。
- **扣费最终一致**：ProxyCore 上报 → 业务面 `deduct`，`requestId` 幂等 + 对账兜底，非强一致。
- **本次为进程内重构，但数据源收敛为 Redis**：ProxyCore 仍是 backend 进程内模块（Nest service），与 Resolver 同进程，但只依赖 Redis 计数 + fetch、不依赖 MongoDB，为后续独立服务（路径 2）铺好数据前提。

### 3.4 MeterBackend 抽象（Redis 计数）

- 收口 `RateLimitService`（速率计数）、`ConcurrencyService`（并发计数）、用量限额判断为一个 `MeterBackend` 接口。
- 实现采用 `RedisMeterBackend`（ioredis，`REDIS_URL`）：ProxyCore 只依赖 Redis 计数，不依赖 MongoDB。
- 用量限额判断由「查询 MongoDB 聚合」改为「Redis 计数」；`UsageLog`（MongoDB）仍由业务面落库，供可视化/审计，与 Redis 计数对账。

## 4. 影响范围

纯后端，前端本次不涉及。

| 文件（现状） | 改动 |
|---|---|
| `proxy/protocol/` | **新增** 协议类型 + 枚举 |
| `proxy/policy-resolver.service.ts` | **新增** PolicyResolver（或从 quota-limit 抽取） |
| `proxy/proxy.service.ts` | 重构为消费 `StandardRequest` / 产出 `StandardResult` |
| `proxy/meter-backend.ts` | **新增** MeterBackend 接口 |
| `proxy/redis-meter-backend.ts` | **新增** RedisMeterBackend（ioredis 计数，`REDIS_URL`） |
| `proxy/rate-limit.service.ts` / `concurrency.service.ts` | 逻辑收口进 MemoryMeterBackend（或保留为内部实现） |
| `billing/quota-limit.service.ts` | 解析逻辑移入 Resolver，保留/裁剪执行逻辑 |
| `usage/usage.service.ts` | 聚合方法对齐 MeterBackend |

## 5. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| REQ-001 协议类型 + PolicyResolver | 定义协议类型/枚举；抽取 PolicyResolver 产出 `StandardPolicy` + `Candidate[]` | 单测覆盖三层合并（状态求值、白名单交集、限额扁平化、余额→`balance_ok`、模型禁用→`model_active`）；lint/typecheck 通过 |
| REQ-002 ProxyCore 重构 + MeterBackend | 重构转发核心消费 `StandardRequest`；抽取 `MeterBackend` + `RedisMeterBackend`（ioredis 计数）；业务面消费 `StandardResult` 落库/扣费 | 转发回归（三协议、流式/非流式、多渠道 fallback、429 切换、计量扣费、余额 402）行为不变；单测覆盖；lint/typecheck 通过 |

> 依据 `docs/rules/REQUIREMENT.md`：REQ-001 为前置基础、REQ-002 为上层功能，各自可独立验收，故拆 2 个。

## 6. 里程碑

1. [ ] REQ-001 协议类型 + PolicyResolver
2. [ ] REQ-002 ProxyCore 重构 + MeterBackend

## 7. 风险与待决

| 编号 | 事项 | 应对 |
|---|---|---|
| R-01 | 重构导致转发行为回归 | 现有 `proxy.service.spec.ts` / `quota-limit.service.spec.ts` 作为回归基线，逐条通过 |
| R-02 | 「单次 resolve 快照」语义丢失（原 `enforceLimits once shared across retries`） | Resolver 在请求入口一次性产出，Core 重试复用同一 `StandardRequest.policy` |
| R-03 | Redis 计数与 `UsageLog` 明细双写不一致 | 最终一致，业务面对账回填 Redis；`requestId` 幂等防重 |
| R-04 | 协议类型与 Mongoose 解耦不彻底 | 协议文件不 import 任何 Mongoose/Nest 类型，评审时重点检查 |
| R-05 | Redis 重启导致计数丢失、限额判断失真 | 从 `UsageLog` 聚合回填 Redis（对账重建） |
| P-03 | 跨进程密钥安全 | 不影响本次（进程内），已独立为 `PROXY_KEY_TRANSPORT_SECURITY.MD` |

## 8. 关联

- 上游：`docs/technical/PROXY_POLICY_PROTOCOL.MD`、`docs/technical/PROXY_KEY_TRANSPORT_SECURITY.MD`
- feature：`docs/feature/usage_metering.md`、`docs/feature/billing_quota.md`
- 待建 requirement：`docs/requirement/PROXY_POLICY_PROTOCOL_REQ-001_TYPES_RESOLVER.md`、`docs/requirement/PROXY_POLICY_PROTOCOL_REQ-002_CORE_METER.md`
