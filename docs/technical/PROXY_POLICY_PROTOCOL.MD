# 中转核心策略协议

> 状态：**技术文档（v1 已定稿；P-03 转独立议题，P-04 已定）**
> 起草时间：2026-11-06，修订：2026-11-07
> 范围：仅 `team-llm-gateway` 内部转发层（`apps/portal-backend/src/modules/proxy/`），**与 `team-llm-proxy`（New API）无关**
> 关联：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-04/05/06）、`PROXY_KEY_TRANSPORT_SECURITY.MD`（P-03 独立议题）
> 定位：为「中转核心」后续四条扩展路径（标准协议 → 独立服务 → 多语言实现 → 分布式部署）铺路的第一块地基

---

## 0. 背景与目标

本项目的核心是 **LLM 流量中转**：请求前按策略做限制检测，请求中按渠道优先级与用量做路由决策，请求后做用量统计与日志。其余 UI 与管理 API 均是为流量中转「喂配置」的附属。

当前转发层逻辑集中在 `ProxyService`（`proxy.service.ts`），其中策略解析与策略执行耦合在一起，阻碍后续将中转核心提炼为独立、可多语言实现、可分布式部署的标准服务。

**目标**：把「策略」从 **Nest 服务方法 + Mongoose 文档** 抽象成 **纯数据协议**，使中转核心成为：**无状态、输入输出自包含、实现可替换**。

**设计原则**：协议「精简又有弹性」——把 ProxyCore 的判断原语压到最少（布尔判定、集合成员、计数比较），任何新增门禁都归类到三层之一，无需改动核心。

---

## 1. 现状与痛点

现有请求生命周期（`chatCompletions` / `streamChatCompletions`）：

| 阶段 | 代码落点 | 依赖 |
|---|---|---|
| 请求前 · 策略检测 | `enforceLimits()` | `QuotaLimitService.resolve` + `resolveRateLimits` + `assertUsageLimits` + `BillingService.getSpendableBalance` + `RateLimitService` + `ConcurrencyService` |
| 请求中 · 路由决策 | `getProviderCandidates()` + `tryCandidate()` | `Model.providerBindings`、`Provider` 文档、`ProviderUsageService.isExhausted` |
| 请求后 · 计量 | `recordUsage()` / `recordError()` | `UsageService.record` + `BillingService.deduct` |

**核心痛点**：

1. `ResolvedPolicyContext` 持有 `PolicySetDocument`（Mongoose 文档），策略无法序列化、无法跨进程/跨语言。
2. `QuotaLimitService` 同时承担「策略解析（`resolve`）」与「策略执行（`assertUsageLimits`，内含 `usageService` 聚合查询）」，职责未分离。
3. `RateLimitService.hits` 与 `ConcurrencyService.counters` 均为**进程内 `Map` 内存态**，是分布式化的死穴。
4. 转发层直接查询 `Model` / `Provider` / `ProviderUsage` 等业务集合，无法与业务面解耦。
5. 余额（`getSpendableBalance`）、租户/团队状态、key 状态等「外部值判断」与「量化限额」混在 `enforceLimits` 里，语义不分层。

---

## 2. 设计决策记录（设计意图）

> 本节记录协议设计过程中的关键取舍与理由，供后续开发者理解「为什么这么设计」，避免仅见结论而不知其所以然。

| 编号 | 决策 | 理由（设计意图） |
|---|---|---|
| DR-01 | 核心定位为「流量中转」，UI/管理 API 是附属 | 稳定有效的中转才是价值所在，其余模块是为它「喂配置」 |
| DR-02 | 以「协议标准化」为先 | 它是独立服务、多语言、分布式三条路径共同的地基 |
| DR-03 | 请求执行前拆三层：状态集 / 白名单 / 策略集 | 按「执行复杂度」分层，把核心判断原语压到最少，精简又有弹性 |
| DR-04 | 三层边界 = 外部求值布尔 / 集合成员 / 量化限额 | 三者求值方式本质不同：外部算好结论 vs 集合成员 vs 计数聚合 |
| DR-05 | 余额归状态集（`balance_ok`），不单独设字段 | 余额是「外部值判断」的布尔门禁，非量化限额，应统一进状态集 |
| DR-06 | 模型禁用 → 状态集；渠道禁用 → candidates 过滤 | 前者是「整体失败」门禁，后者是「跳过候选试下一个」的路由，失败语义不同 |
| DR-07 | 状态带 `action`(block/warn) + 稳定 `code` | 与策略集对齐、弹性更大；`code` 供机器识别失败原因 |
| DR-08 | 白名单「交集合并」成单值 | 核心只看最终结论，三级来源明细归业务面诊断（经 `StandardResult.error.code` 带层级标签） |
| DR-09 | 执行顺序：状态集 → 白名单 → 策略集 | 按成本递增，fail-fast，最便宜的先挡 |
| DR-10 | 版本演进：`version` 字段 + 新增字段必须可选带默认值 | 当前同进程同发版，无版本错配，正式协商机制是过度设计，留到路径 2 |
| DR-11 | ProxyCore 只依赖 Redis、不依赖 MongoDB | 数据面运行时依赖收敛到单一数据源，独立成服务无需携带 Mongoose/MongoDB，且天然支持分布式 |
| DR-12 | 用量限额计数式（Redis）、扣费最终一致 | 计数保证 O(1) 限流判断；ProxyCore 上报 → 业务面 `deduct`，`requestId` 幂等 + 对账兜底，放弃强一致 |

---

## 3. 协议定义（v1）

### 3.1 协议层枚举（与 Mongoose 解耦，纯协议）

```ts
enum Measure { TOKEN = 'token', REQUEST = 'request', CONCURRENCY = 'concurrency', SPEND = 'spend' }
enum Window  { PERMANENT = 'permanent', MINUTE = 'minute', HOUR = 'hour', DAY = 'day', WEEK = 'week', MONTH = 'month' }
enum Action  { BLOCK = 'block', WARN = 'warn' }
```

> 与 `policy-set.schema.ts` 中的 `PolicyMeasure` / `PolicyWindow` / `PolicyAction` 一一对应，但属协议层，不依赖 Mongoose。

### 3.2 标准策略快照 `StandardPolicy`

核心变化：请求执行前逻辑拆为**三层判定**——状态集 → 白名单 → 策略集。三层均由 Resolver 预计算/合并，ProxyCore 只做轻量判定。

```ts
interface StandardPolicy {
  version: 1;
  subject: {
    tenantId: string;
    teamId: string;
    userId: string;
    apiKeyId: string;
  };
  // ① 状态集：外部已求值的布尔门禁，block 全过才放行，warn 仅告警
  states: StandardState[];
  // ② 白名单：集合成员判定（null = 不限）
  allowlists: {
    model: string[] | null;
    provider: string[] | null;
  };
  // ③ 策略集：量化限额，需 MeterBackend 计数/聚合
  limits: StandardLimit[];
}

interface StandardState {
  name: string;     // 稳定标识，如 'balance_ok' / 'tenant_active' / 'key_active' / 'model_active'
  ok: boolean;      // Resolver 已求值
  action: Action;   // block：ok=false 则拒绝；warn：ok=false 仅告警
  code?: string;    // 不通过时的稳定错误码，如 'BALANCE_INSUFFICIENT' / 'MODEL_DISABLED'
  message?: string;
}

interface StandardLimit {
  scope: 'team' | 'member' | 'key';  // 计数/聚合的归属维度
  measure: Measure;
  window: Window;
  limit: number;                     // > 0
  action: Action;
}
```

### 3.3 三层判定逻辑

| 层 | 本质 | 判定方式 | 求值方 | 典型用例 | 状态依赖 |
|---|---|---|---|---|---|
| ① 状态集 | 外部求值的一次性布尔结论 | 逐项判定：`block` 全过才放行，`warn` 仅告警 | Resolver 求值 | 余额充足、租户/团队激活、key 未吊销、模型禁用 | 零状态 |
| ② 白名单 | 集合成员资格 | `∈` | Resolver 合并 | 模型白名单、渠道白名单（策略集配置的排除） | 零状态 |
| ③ 策略集 | 量化限额 | `count/aggregate < limit` | Resolver 出限额，ProxyCore+Meter 计数 | 速率、token/spend 用量、并发 | 有状态 |

**执行顺序：状态集 → 白名单 → 策略集**（按成本递增，fail-fast）。

**状态集执行语义**：遍历 `states`——`action=block` 且 `ok=false` 则拒绝并返回其 `code`/`message`；`action=warn` 且 `ok=false` 仅告警继续；`ok=true` 放行。与策略集 `action` 语义一致。

**模型 vs 渠道禁用**：模型禁用是「整个请求直接失败」的门禁 → 状态集（`model_active`）；渠道禁用是「跳过该候选、试下一个」的路由行为 → Resolver 产出 `candidates` 时直接过滤，不进候选。

### 3.4 标准请求 `StandardRequest`

关键点：**路由候选（渠道连接信息）也由业务面预置**，中转核心不查 `Model` / `Provider`。

```ts
interface StandardRequest {
  policy: StandardPolicy;
  modelId: string;
  body: unknown;               // OpenAI / Anthropic / Gemini 原始语义
  stream: boolean;
  candidates: Candidate[];     // 已按 priority 升序
}

interface Candidate {
  providerId: string;
  priority: number;
  type: 'openai-compatible' | 'anthropic' | 'gemini';
  baseUrl: string;
  apiKey: string;              // Resolver 已解密（进程内契约；独立服务化时替换，见 P-03）
  authType: string;
  multiplier: number;          // 成本 = multiplier × token
}
```

### 3.5 标准结果 `StandardResult`

```ts
interface StandardResult {
  requestId: string;
  modelId: string;
  providerId?: string;                            // 实际命中渠道
  status: 'success' | 'error' | 'exhausted';
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  cost?: number;
  latencyMs: number;
  error?: { code: string; message: string };
  providerEvents?: Array<{                        // 渠道状态变化，业务面回写
    providerId: string;
    event: 'exhausted' | 'rate-limit-headers';
    headers?: Record<string, string>;
  }>;
}
```

---

## 4. 职责边界

这是「标准化」的真正含义——把现有 `enforceLimits()` 拆成两半：

| 角色 | 位置 | 职责 | 依赖 |
|---|---|---|---|
| **PolicyResolver** | 留在 Portal 业务面 | 查三级策略集（team/role/key）→ 合并 → 产出 `StandardPolicy`（states + allowlists + limits）与 `Candidate[]`；求值余额/状态 | Mongoose、billing、密钥解密 |
| **ProxyCore** | 进程内模块（当前）/ 独立服务（路径 2） | 消费 `StandardRequest` → 状态集判定（block/warn） → 白名单 ∈ → 策略集计数 → 路由决策 → 转发 → 计量 → 产出 `StandardResult` | 仅 `Redis`（MeterBackend 计数）+ fetch，**不依赖 MongoDB** |

> **ProxyCore 数据源**：本次 plan 起，ProxyCore **只依赖 Redis**（`MeterBackend` 计数）与上游 fetch，**不依赖 MongoDB**——独立成服务（路径 2）时无需携带 Mongoose/MongoDB，且 Redis 计数天然支持路径 4 分布式。ProxyCore 仍是 backend 进程内模块（与 Resolver 同进程）。

映射到现有代码：

| 现有方法 | 归属 |
|---|---|
| `QuotaLimitService.resolve` | → Resolver |
| `resolveModel` 的 `status` 查询（模型禁用） | → Resolver（折成状态 `model_active`） |
| `QuotaLimitService.isModelAllowed` / `isProviderAllowed` | → Resolver（合并成 allowlists） |
| `QuotaLimitService.resolveRateLimits` | → Resolver（合并成 limits） |
| `BillingService.getSpendableBalance` | → Resolver（折成状态 `balance_ok`） |
| `QuotaLimitService.assertUsageLimits` | → ProxyCore（消费 limits + `MeterBackend.sum`） |
| `RateLimitService` / `ConcurrencyService` | → ProxyCore（经 `MeterBackend` 抽象） |
| `getProviderCandidates` / `tryCandidate` | → Resolver 产 candidates + ProxyCore 做 fallback 决策 |
| `recordUsage` / `recordError` | → ProxyCore 产 `StandardResult`，业务面落库/扣费 |

---

## 5. MeterBackend 抽象（Redis 计数，ProxyCore 唯一状态依赖）

ProxyCore **只依赖 Redis**（计数状态）与上游 fetch，**不依赖 MongoDB**。收口三类「状态」为统一的计数式后端：

```ts
interface MeterBackend {
  // 请求前：限额判断（Redis 计数，O(1)）
  checkLimit(scope: { kind: 'team' | 'member' | 'key'; id: string },
             measure: Measure, window: Window, limit: number): Promise<boolean>;
  // 请求后：累加用量计数（按 scope × measure × window 多桶）
  increment(scope: { kind: 'team' | 'member' | 'key'; id: string },
            measure: Measure, window: Window, amount: number): Promise<void>;
  // 并发
  acquireConcurrency(key: string, limit: number): Promise<() => Promise<void>>;
}
```

**实现**：`RedisMeterBackend`（ioredis，`REDIS_URL`）。

**窗口策略**：`minute` 固定窗口（EXPIRE 60s）；`hour/day/week/month` 固定窗口（key 含窗口起始时间戳，EXPIRE 至窗口结束）；`permanent` 无 TTL 累计。

**双写与对账**：Redis 存「计数」（供实时限流/限额判断，快但无明细）；MongoDB `UsageLog` 存「明细」（供可视化/审计，由业务面消费 `StandardResult` 落库）。两者最终一致，由业务面对账回填 Redis（防 Redis 重启计数丢失导致超额）。**扣费最终一致**：ProxyCore 上报 `StandardResult`，业务面 `deduct`，`requestId` 幂等 + 对账兜底，不追求强一致。

**渠道耗尽状态**：同样走 Redis——ProxyCore 经 `StandardResult.providerEvents` 上报，业务面写 Redis，Resolver 下次读 Redis 预置候选。

---

## 6. 待决事项

| 编号 | 事项 | 说明 | 状态 |
|---|---|---|---|
| P-01 | **白名单合并粒度** | 三级白名单按「交集合并」成单值（核心只看最终结论） | 已定 |
| P-02 | **余额归属** | 余额检查归「状态集」（`balance_ok`），不再单独设字段 | 已定 |
| P-03 | **跨进程密钥安全** | `Candidate.apiKey` 跨进程传输保护；当前进程内最简实现，独立服务化前须解决 | 转独立议题：`PROXY_KEY_TRANSPORT_SECURITY.MD` |
| P-04 | **协议版本演进** | `version` 字段 + 新增字段必须可选带默认值；正式协商留到路径 2 | 已定 |
| P-05 | **状态集边界与语义** | 状态带 `action`（block/warn）；`code` 为稳定错误码；边界 = 外部求值布尔 vs 集合成员 vs 量化限额 | 已定 |

---

## 7. 演进路径（后续扩展）

```
协议标准化（本文档） ──► 独立服务（路径2，前置：P-03）
        └──────────────► 多语言实现（路径3，只依赖协议不依赖服务化）
                         └──► 分布式部署（路径4，前提：MeterBackend 外置）
```

> 落地顺序以「协议标准化」为先（v1 已定稿），后续再谈独立服务、多语言、分布式。
