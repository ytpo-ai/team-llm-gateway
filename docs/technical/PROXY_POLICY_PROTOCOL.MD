# 中转核心策略协议（草案）

> 状态：**草案（待讨论，未进入 plan / requirement）**
> 起草时间：2026-11-06
> 范围：仅 `team-llm-gateway` 内部转发层（`apps/portal-backend/src/modules/proxy/`），**与 `team-llm-proxy`（New API）无关**
> 关联：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-04/05/06）
> 定位：为「中转核心」后续四条扩展路径（标准协议 → 独立服务 → 多语言实现 → 分布式部署）铺路的第一块地基

---

## 0. 背景与目标

本项目的核心是 **LLM 流量中转**：请求前按策略做限制检测，请求中按渠道优先级与用量做路由决策，请求后做用量统计与日志。其余 UI 与管理 API 均是为流量中转「喂配置」的附属。

当前转发层逻辑集中在 `ProxyService`（`proxy.service.ts`），其中策略解析与策略执行耦合在一起，阻碍后续将中转核心提炼为独立、可多语言实现、可分布式部署的标准服务。

**目标**：把「策略」从 **Nest 服务方法 + Mongoose 文档** 抽象成 **纯数据协议**，使中转核心成为：**无状态、输入输出自包含、实现可替换**。

---

## 1. 现状与痛点

现有请求生命周期（`chatCompletions` / `streamChatCompletions`）：

| 阶段 | 代码落点 | 依赖 |
|---|---|---|
| 请求前 · 策略检测 | `enforceLimits()` | `QuotaLimitService.resolve` + `resolveRateLimits` + `assertUsageLimits` + `BillingService.getSpendableBalance` + `RateLimitService` + `ConcurrencyService` |
| 请求中 · 路由决策 | `getProviderCandidates()` + `tryCandidate()` | `Model.providerBindings`、`Provider` 文档、`ProviderUsageService.getAvailability` |
| 请求后 · 计量 | `recordUsage()` / `recordError()` | `UsageService.record` + `BillingService.deduct` |

**核心痛点**：

1. `ResolvedPolicyContext` 持有 `PolicySetDocument`（Mongoose 文档），策略无法序列化、无法跨进程/跨语言。
2. `QuotaLimitService` 同时承担「策略解析（`resolve`）」与「策略执行（`assertUsageLimits`，内含 `usageService` 聚合查询）」，职责未分离。
3. `RateLimitService.hits` 与 `ConcurrencyService.counters` 均为**进程内 `Map` 内存态**，是分布式化的死穴。
4. 转发层直接查询 `Model` / `Provider` / `ProviderUsage` 等业务集合，无法与业务面解耦。

---

## 2. 协议定义（v1 草案）

### 2.1 协议层枚举（与 Mongoose 解耦，纯协议）

```ts
enum Measure { TOKEN = 'token', REQUEST = 'request', CONCURRENCY = 'concurrency', SPEND = 'spend' }
enum Window  { PERMANENT = 'permanent', MINUTE = 'minute', HOUR = 'hour', DAY = 'day', WEEK = 'week', MONTH = 'month' }
enum Action  { BLOCK = 'block', WARN = 'warn' }
```

> 与 `policy-set.schema.ts` 中的 `PolicyMeasure` / `PolicyWindow` / `PolicyAction` 一一对应，但属协议层，不依赖 Mongoose。

### 2.2 标准策略快照 `StandardPolicy`

核心变化：**不再是三级原始文档，而是 Resolver 合并好的「最终生效结论」**。

```ts
interface StandardPolicy {
  version: 1;                                        // 协议版本
  subject: {
    tenantId: string;
    teamId: string;
    userId: string;
    apiKeyId: string;
  };
  modelAllowlist: string[] | null;                   // 三级白名单交集；null = 不限
  providerAllowlist: string[] | null;                // 同上
  limits: StandardLimit[];                           // 扁平化限额清单
}

interface StandardLimit {
  scope: 'team' | 'member' | 'key';                  // 计数/聚合的归属维度
  measure: Measure;
  window: Window;
  limit: number;                                     // > 0
  action: Action;
}
```

合并规则（由 Resolver 完成）：

- 白名单：`isModelAllowed` / `isProviderAllowed` 的「任一层有白名单即收紧」语义 = 各层白名单**交集**。
- 速率：`minBlockLimit` 的「同 measure × window 取最小」语义在 Resolver 内完成，产出扁平化 `StandardLimit`。

### 2.3 标准请求 `StandardRequest`

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
  apiKey: string;              // Resolver 已解密
  authType: string;
  multiplier: number;          // 成本 = multiplier × token
}
```

### 2.4 标准结果 `StandardResult`

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

## 3. 职责边界

这是「标准化」的真正含义——把现有 `enforceLimits()` 拆成两半：

| 角色 | 位置 | 职责 | 依赖 |
|---|---|---|---|
| **PolicyResolver** | 留在 Portal 业务面 | 查三级策略集（team/role/key）→ 合并 → 产出 `StandardPolicy` + `Candidate[]`；查余额 | Mongoose、billing、密钥解密 |
| **ProxyCore** | 标准中转服务 | 消费 `StandardRequest` → 限制检测 → 路由决策 → 转发 → 计量 → 产出 `StandardResult` | 无业务依赖，仅 `MeterBackend` + fetch |

映射到现有代码：

| 现有方法 | 归属 |
|---|---|
| `QuotaLimitService.resolve` | → Resolver |
| `QuotaLimitService.isModelAllowed` / `isProviderAllowed` | → Resolver（合并成 allowlist） |
| `QuotaLimitService.resolveRateLimits` | → Resolver（合并成 `limits`） |
| `QuotaLimitService.assertUsageLimits` | → ProxyCore（消费 `limits` + `MeterBackend.sum`） |
| `RateLimitService` / `ConcurrencyService` | → ProxyCore（经 `MeterBackend` 抽象） |
| `getProviderCandidates` / `tryCandidate` | → Resolver 产 candidates + ProxyCore 做 fallback 决策 |
| `recordUsage` / `recordError` | → ProxyCore 产 `StandardResult`，业务面落库/扣费 |

---

## 4. MeterBackend 抽象（为分布式铺路，基础版仅占位）

收口三处「状态」为可插拔后端：

```ts
interface MeterBackend {
  // 速率/并发计数（当前进程内 Map → 未来 Redis）
  countHit(key: string, windowMs: number, limit: number): Promise<boolean>;
  acquireConcurrency(key: string, limit: number): Promise<() => Promise<void>>;
  // 用量聚合（当前查 UsageLog → 未来可缓存/预聚合）
  sum(scope: { kind: 'team' | 'member' | 'key'; id: string },
      measure: Measure, window: Window): Promise<number>;
}
```

- 基础版：`MemoryMeterBackend`（复刻现有行为）
- 后续：`RedisMeterBackend`（解锁多实例部署）

---

## 5. 待决事项

| 编号 | 事项 | 说明 |
|---|---|---|
| P-01 | **合并粒度** | 三级白名单按「交集合并」成单值（中转核心只看最终结论，不区分 team/key 层）？还是保留三级原始结构、把合并留到执行时？ |
| P-02 | **余额归属** | 余额检查（`getSpendableBalance <= 0` 抛 402）由 Resolver 折算为 `StandardPolicy` 结论字段（如 `spendable: boolean`）？请求后扣费回写走 `StandardResult` 由业务面扣，还是中转核心直接调扣费接口？ |
| P-03 | **跨进程密钥安全** | `Candidate.apiKey` 为已解密上游密钥，路径 2（独立服务）跨进程传输时如何保护？ |
| P-04 | **协议版本演进** | `version: 1` 的升级与兼容策略如何约定？ |

---

## 6. 演进路径（后续扩展）

```
协议标准化（本文档） ──► 独立服务（路径2）
        └──────────────► 多语言实现（路径3，只依赖协议不依赖服务化）
                         └──► 分布式部署（路径4，前提：MeterBackend 外置）
```

> 本草案落地顺序以「协议标准化」为先（P-01/P-02 定稿后），后续再谈独立服务、多语言、分布式。
