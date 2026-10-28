# LLM API 中转 / 代理 / 网关开源项目调研

> 数据来源：GitHub API 实时拉取
> 采集时间：2026-10-27
> 调研目的：为大模型 API Key/Token 中转站、API 代理站的技术选型提供参考

## 1. 头部项目对比（按 Star 排序）

| 项目 | Star | Fork | 语言 | 最近更新 | 定位说明 |
|---|---|---|---|---|---|
| [BerriAI/litellm](https://github.com/BerriAI/litellm) | 62,097 | 12,712 | Python | 当天 (10-27) | 最强通用 AI Gateway，100+ 模型，Rust 内核 |
| [QuantumNous/new-api](https://github.com/QuantumNous/new-api) | 50,758 | 12,283 | Go | 10-25 | One API 社区继任版，国内中转站主流选择 |
| [songquanpeng/one-api](https://github.com/songquanpeng/one-api) | 37,257 | 6,888 | Go/JS | 01-09（基本停更） | 始祖项目，现已不活跃 |
| [casdoor/casdoor](https://github.com/casdoor/casdoor) | 14,678 | 1,875 | Go | 当天 (10-27) | IAM + LLM 接入/计费能力 |
| [Portkey-AI/gateway](https://github.com/Portkey-AI/gateway) | 13,277 | 1,358 | TypeScript | 05-25 | 商业级网关，1600+ 模型 + 护栏 |
| [tensorzero/tensorzero](https://github.com/tensorzero/tensorzero) | 11,708 | 968 | Rust | 06-11 | LLM 网关 + 评测，性能强 |
| [coaidev/coai](https://github.com/coaidev/coai) | 9,332 | 1,226 | TypeScript | 03-12 | 多租户 AI 一站式 + 计费 |
| [maximhq/bifrost](https://github.com/maximhq/bifrost) | 9,128 | 1,470 | Go | 当天 (10-27) | 高性能 AI Gateway（Bifrost） |
| [mnfst/llm-gateway](https://github.com/mnfst/llm-gateway) | 7,602 | 523 | TypeScript | 10-26 | 新兴通用 LLM 网关 |
| [Helicone/helicone](https://github.com/Helicone/helicone) | 6,239 | 694 | TypeScript | 10-24 | 主打可观测性 + 代理（YC W23） |
| [looplj/axonhub](https://github.com/looplj/axonhub) | 5,400 | 746 | Go | 当天 (10-27) | 任意 SDK 调用 100+ LLM |

## 2. 其他值得关注

| 项目 | Star | Fork | 语言 | 最近更新 | 说明 |
|---|---|---|---|---|---|
| [novicezk/midjourney-proxy](https://github.com/novicezk/midjourney-proxy) | 5,371 | 2,387 | Java | 2025-08-03 | MidJourney 绘图 API 代理，国内社区经典 |
| [future-agi/future-agi](https://github.com/future-agi/future-agi) | 2,208 | 696 | Python | 当天 (10-27) | 评估/观测/优化平台 |
| [APIParkLab/APIPark](https://github.com/APIParkLab/APIPark) | 1,820 | 245 | TypeScript | 当天 (10-27) | 云原生 AI&API 网关 |
| [aklivity/zilla](https://github.com/aklivity/zilla) | 1,688 | 145 | Java | 当天 (10-27) | 流式多协议 AI/API 网关 |
| [bricks-cloud/BricksLLM](https://github.com/bricks-cloud/BricksLLM) | 1,230 | 98 | Go | 2025-01-05（停更） | 企业级成本控制网关 |
| [mozilla-ai/otari](https://github.com/mozilla-ai/otari) | 741 | 93 | Python | 当天 (10-27) | Mozilla 自托管 OpenAI 兼容网关 |
| [smg-project/smg](https://github.com/smg-project/smg) | 683 | 200 | Rust | 当天 (10-27) | 引擎无关 Rust LLM 网关 |

## 3. 选型建议

- **做中转站 / 分发（国内场景）**：首选 `new-api`，其次 `one-api`（已停更，仅作参考）
- **做通用网关 / 企业级**：首选 `LiteLLM`，其次 `Portkey Gateway` / `Bifrost` / `AxonHub`
- **要极速 Rust 性能**：`tensorzero`、`smg`、`eliasbiondo/antirion`

### 活跃度 TOP3

LiteLLM、new-api、Bifrost（均为 10 月内持续提交）。

> 注意：`one-api` 已被 `new-api` 反超且长期停更，新项目建议直接上 `new-api`。

## 4. 三大主流项目详细对比（New API / LiteLLM Proxy / Portkey Gateway）

> 数据来源：GitHub README 与官方文档实时核对
> 采集时间：2026-10-27

### 4.1 一句话定位

| 项目 | 定位 |
|---|---|
| **New API** | 面向「API 中转/分发/转售」的自托管网关，国内社区主流，本质是「多模型账号 + 计费 + 用户运营」系统 |
| **LiteLLM Proxy** | 面向「平台/企业工程团队」的通用 LLM 网关，本质是「统一 OpenAI 兼容入口 + 虚拟密钥 + 预算/限额 + 可观测性」 |
| **Portkey Gateway** | 面向「生产级 AI 应用/Agent」的商业级网关（开源版 + 云托管），本质是「高可靠路由 + 护栏 + 可观测」的构建块 |

### 4.2 核心差异总览

| 维度 | New API | LiteLLM Proxy | Portkey Gateway |
|---|---|---|---|
| 语言/内核 | Go | Python + Rust 内核 | TypeScript (Node) |
| Star | ~50.8k | ~62.1k | ~13.3k |
| 起源/社区 | 国内（One API 继任） | 全球（AI 工程团队） | 全球（商业公司开源） |
| 首要场景 | **转售/分发/计费** | **企业统一网关** | **应用级可靠性路由** |
| 模型/Provider 覆盖 | 主流通用 + 国内模型 | 100+ LLM | 1600+ 模型 / 250+ 厂商 |
| 计费模型 | 令牌额度/倍率/订阅/兑换码 | 按 USD 计费、预算上限 | 预算/成本看板 |
| 面向对象 | 个人站长/中转站 | 平台团队 | 应用开发者 |

### 4.3 分维度详解

**1. 模型接入与协议**
- **New API**：支持 OpenAI（Chat/Responses）、Anthropic Messages、Gemini 协议，Azure/Bedrock/Vertex/DeepSeek/千问；偏「通用兼容」，覆盖国内厂商是强项。
- **LiteLLM**：OpenAI 格式统一接入 100+ 厂商，覆盖面广且翻译层成熟；额外支持 MCP 工具、A2A Agent。
- **Portkey**：宣称 1600+ 模型，强调多模态（视觉/音频 TTS/STT/图像）、Realtime API、流式支持完善，模型面最宽。

**2. 路由与可靠性（LiteLLM/Portkey 更强）**
- **New API**：渠道优先级/权重、失败重试、渠道亲和性、多 Key 轮询——够用，但面向「渠道调度」而非「应用级可靠性」。
- **LiteLLM**：Router 内建负载均衡、fallback、retry。
- **Portkey**：三者中最全——fallbacks、自动重试、负载均衡（加权）、条件路由、断路器、金丝雀测试、请求超时。

**3. 计费与成本管理（New API 独有优势）**
- **New API**：独有「运营级」计费能力——兑换码、在线充值（易支付/Stripe/EPay）、订阅套餐、邀请奖励、分组倍率、缓存计费、阶梯定价。
- **LiteLLM**：面向内部成本核算——虚拟密钥预算、团队/用户预算、USD 花费追踪。
- **Portkey**：预算限制 + 使用分析 + 成本看板，另有 Provider optimization（部分为托管特性）。

**4. 访问控制**
- **New API**：用户/分组/细粒度权限/API Key 限制，OAuth/OIDC、通行密钥、2FA、会话管理——偏「站点用户体系」。
- **LiteLLM**：虚拟密钥（Key/User/Team 三级），SSO，细粒度 allowed_routes/模型/MCP 权限继承。
- **Portkey**：虚拟密钥 + RBAC + workspace 层级 + 审计日志（更偏企业级治理）。

**5. 护栏与安全**
- **New API**：基本无内置护栏。
- **LiteLLM**：Guardrails（PII 脱敏、内容过滤、策略流、Secret 检测、Lakera/Azure/Bedrock 等第三方）。
- **Portkey**：最强——50+ 护栏（确定性规则/LLM 护栏/第三方/自建），SOC2/HIPAA/GDPR/CCPA 合规声明。

**6. 可观测性**
- **New API**：内置日志、审计日志、数据看板/排行榜（面向运营，非 OpenTelemetry 体系）。
- **LiteLLM**：开放可观测生态——Langfuse/Datadog/OTel/Prometheus/Grafana 等，标准可观测栈对接最成熟。
- **Portkey**：自建 OTel 兼容体系——logs/tracing/analytics/feedback/metadata，成本与延迟看板丰富。

**7. 部署与运维**
- **New API**：SQLite 单机可跑（Docker 一条命令），生产 Compose 用 PG/MySQL + Redis + ClickHouse 日志库；单二进制，运维最轻。
- **LiteLLM**：依赖 Postgres + Redis（生产必需），Docker/Helm/Terraform，异步写库（数据库不阻塞请求路径），架构更「工程化」。
- **Portkey**：体积极小（122kb）、宣称 <1ms 额外延迟，轻量 Node 服务，可嵌入应用，亦有云托管。

**8. 附加能力**
- **New API**：Midjourney/Suno 等异步任务（JS 插件）、/chat2link 聊天页、Rerank、多语言控制台。
- **LiteLLM**：MCP Gateway/A2A、智能缓存、策略流构建器。
- **Portkey**：MCP Gateway、Agent 框架集成（LangChain/CrewAI/Autogen 等）、Prompt 管理库、语义缓存。

### 4.4 选型结论

- **做中转站/转售/分发（面向 C 端计费）** → 选 **New API**：兑换码、充值、订阅、分组倍率是独有刚需。
- **做企业内部统一网关/平台** → 选 **LiteLLM Proxy**：预算/虚拟密钥/可观测生态最成熟，社区最大。
- **做高可靠生产应用/Agent 接入** → 选 **Portkey Gateway**：路由可靠性 + 护栏最强，模型面最宽。
