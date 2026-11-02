# team-llm-gateway 与 LiteLLM 功能差距分析

> 目的：对比当前项目（team-llm-gateway）与 LiteLLM 的功能面差距，明确「已具备 / 差距 / 差异化优势」，为后续 roadmap 与 `team-llm-proxy` 启动提供决策依据。
>
> - 定稿时间：2026-10-29
> - 数据来源：`docs/technical/LLM_API_GATEWAY_COMPARISON.MD`（2026-10-27 采集）、当前项目源码与 `docs/feature/` / `docs/dailylog/` 现状
> - 上游决策依据：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-01~12）

---

## 1. 定位差异（先厘清比较基准）

| 维度 | team-llm-gateway（当前项目） | LiteLLM |
|---|---|---|
| 产品形态 | 团队接入平台（Portal），数据面仅最小转发 | 通用 LLM 网关，数据面 + 控制面一体 |
| 首要场景 | 团队/成员/APIKey + 细粒度计量 + 选型建议 | 企业统一 OpenAI 兼容入口 + 虚拟密钥 + 预算 + 可观测 |
| 当前数据面 | 仅 `openai-compatible` 上游，`POST /v1/chat/completions`（SSE 透传）+ `GET /v1/models` | 100+ 厂商、多协议、路由、缓存、护栏 |
| 完整中转能力 | 规划中的 `team-llm-proxy`（基于 new-api 改造，**尚未启动**，作为 gateway 首选上游、可旁路） | 已具备 |

> 结论：两者不是同类产品。当前项目与 LiteLLM 的差距**集中在中转/数据面**。这一层由 `team-llm-proxy` 承接（ADR-13：proxy 是 gateway 的首选上游、可旁路；gateway 亦可直连任意 LLM 官方/第三方），并非 LiteLLM 路线。

---

## 2. 数据面差距（核心差距，当前几乎空白）

| 能力 | LiteLLM | 当前项目 | 差距 |
|---|---|---|---|
| 厂商覆盖 | 100+ 厂商统一接入 | 仅 `openai-compatible` 一种类型 | 巨大 |
| 协议面 | Chat/Responses/Messages/Gemini/Embedding/Audio(TTS·STT)/Image/Rerank/Realtime | 仅 Chat Completions | 巨大 |
| 协议翻译 | OpenAI 格式统一 + 多协议互转 | 无（只做透传） | 巨大 |
| 路由可靠性 | 负载均衡 / fallback / retry / 超时 | 无（仅模型→上游单线解析） | 巨大 |
| 缓存 | 精确 + 语义缓存 | 无 | 缺失 |
| 护栏 Guardrails | PII 脱敏 / 内容过滤 / 策略流 / 第三方(Lakera·Azure·Bedrock) | 无 | 缺失 |
| MCP / A2A | MCP Gateway、A2A Agent | 无 | 缺失 |

---

## 3. 控制面差距

| 能力 | LiteLLM | 当前项目 | 差距 |
|---|---|---|---|
| 密钥体系 | 虚拟密钥 Key/User/Team 三级 + budget + allowed_routes | API Key（allowedModels / rateLimitPerMinute / maxTokens） | 中（粒度相近，缺 route 级权限与预算绑定） |
| 预算控制 | 按 USD 计费，soft/hard 限额 | 团队/成员两级额度账户（余额扣减 + 流水） | 各有所长 |
| 可观测 | OTel/Prometheus/Grafana/Langfuse/Datadog 标准栈 | MongoDB 聚合 + SVG 自绘看板 | 中 |
| SSO/认证 | SSO、OIDC、多认证源 | 本地 JWT 账号（OIDC/OAuth 仅预留） | 中 |
| 计费运营 | 仅成本追踪 | 充值/手动调整 + 额度流水 | 当前更强 |

---

## 4. 当前项目的差异化优势（LiteLLM 无/弱）

| 能力 | 说明 | LiteLLM 现状 |
|---|---|---|
| 模型选型建议 | 办公场景模板 + 能力匹配 + 倍率排序推荐引擎（`model_recommendation`） | 无 |
| 团队→成员→角色→成员额度 | 四级层级 + 邀请链接（`team_member`） | 仅 Team 一层，无成员级额度细分 |
| 服务商全局视角/多租户 | 多租户管理 + 全局看板（`admin_overview`，仅 SaaS） | 无真正多租户 |
| 审计日志 | 关键写操作埋点（`system_admin`） | 仅基础日志 |

---

## 5. 结论与建议

1. **差距集中在数据面**（协议翻译、路由可靠性、缓存、护栏、厂商覆盖），这些正是「中转站」本职，应由 `team-llm-proxy`（基于 new-api 改造，作为 gateway 首选上游、可旁路）承接，而非自研或 LiteLLM 路线。`GATEWAY_NEWAPI_FEATURE_CUT.MD` 已论证「改造 vs 重写」的结论，重写 45 厂商适配 + 4 协议翻译不可接受。
2. **控制面当前项目已贴合「团队接入」场景**，团队/成员/额度/选型/多租户是护城河，LiteLLM 不构成替代威胁。
3. **可借鉴的 LiteLLM 能力**（若后续自研补齐或作为 proxy 增强）：route 级密钥权限、标准可观测栈（OTel/Prometheus）、软/硬限额、语义缓存。
4. **优先级建议**：先启动 `team-llm-proxy` 补齐数据面，再按需引入 LiteLLM 的可观测/护栏理念到 Portal 侧，而非直接采用 LiteLLM。

---

## 6. 关联

- 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`
- 参考调研：`docs/technical/LLM_API_GATEWAY_COMPARISON.MD`
- 裁剪清单：`docs/technical/GATEWAY_NEWAPI_FEATURE_CUT.MD`
