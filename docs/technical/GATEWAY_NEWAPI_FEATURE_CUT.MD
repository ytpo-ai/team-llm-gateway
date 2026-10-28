# Gateway 的 New API 功能裁剪清单（D-01）

> 目标：逐项过 New API 功能，确定「保留 / 裁剪 / 改造」，评估「重写 vs 基于现有项目改造」的技术成本。
>
> - 来源：`forks/new-api` 源码（router / controller / model / service / middleware / relay / web）逐项核对
> - 定稿时间：2026-10-28
> - 上游决策依据：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD` ADR-06/07/08、§5.1 组件边界

---

## 1. 结论摘要（TL;DR）

1. **方向：基于 New API 改造，而非重写。** New API 本质就是「中转站 + 站点用户运营」，与 Gateway 定位高度重合，需要裁剪的模块很少。
2. **裁剪面远小于预期**：判定标准里「团队内部管理 / Portal 职责」在 New API 中**几乎没有独立模块可裁剪**（New API 的「用户 = 客户」，无团队→成员→角色层级）；真正需要裁剪的是少量「对办公场景过度设计」模块（GPU 部署、Codex 集成、Electron 桌面端等）。
3. **保留面很大**：用户要求保留的「站点用户运营」能力（兑换码/充值/邀请/订阅/分组倍率/多语言/OAuth/2FA）New API 已完整具备，无需改造。
4. **唯一重大风险是 AGPLv3 授权合规**，不是技术成本（见 §6、§7）。

---

## 2. 裁剪判定标准（本清单采用）

| 分类 | 判定标准 | 说明 |
|---|---|---|
| **保留** | 核心中转能力 + 站点用户运营能力 + 客户级计量计费 + 客户管理 | 中转站本职 + 用户明确要求保留的运营能力 |
| **裁剪** | 对办公场景过度设计 / 非中转站本职 / Portal 职责 | 用户明确授权可裁剪的三类 |
| **改造** | 功能保留但需适配（品牌、授权、对接、部署形态） | 不改逻辑，只做适配层 |

---

## 3. 功能面盘点（基于源码）

### 3.1 代码规模

| 模块 | 规模 | 说明 |
|---|---|---|
| Go 后端（非测试） | **~164K 行** | relay 35K / controller 27K / relaykit 29K / model 22K / service 17K / pkg 9.5K / middleware 5.5K / setting 5.3K |
| Web 前端（ts/tsx） | **~292K 行** | React 19 + TanStack + Tailwind，7 语言 i18n |
| 渠道适配器 | **~45 家** | openai/claude/gemini/aws/azure/vertex/ali/baidu/tencent/zhipu/deepseek/moonshot/xai/… |

> 结论：这是一个体量庞大的成熟工程。**重写 45 家厂商适配 + 4 协议翻译 + 计费引擎 + 控制台，成本不可接受**，是「改造」压倒性胜出的直接证据。

### 3.2 功能全景（按模块）

| 模块 | 主要内容 |
|---|---|
| 协议中继 `relay/` | OpenAI Chat/Responses、Anthropic Messages、Gemini、Embedding、Audio(STT/TTS)、Rerank、Image、Moderations、Video、Realtime/Responses WebSocket |
| 协议内核 `relaykit/` + `tokenkit/` | 四种文本协议互转 DTO、token 计数/估算（独立 Go 模块） |
| 渠道调度 | 优先级/权重、失败重试、渠道亲和性、多密钥轮询、模型映射、限流 |
| 计费 `service/` + `setting/billing_setting/` | 额度/倍率/缓存计费/表达式阶梯定价/模型定价 |
| 用户运营 | 注册登录、OAuth/OIDC、Passkey、2FA、会话管理、Access Token、兑换码、充值、订阅、邀请奖励、签到、分组倍率 |
| 客户管理 | 用户 CRUD、分组、令牌(apikey)管理、渠道管理、模型元数据、审计日志、Casbin 细粒度权限 |
| 控制台 `web/` | Dashboard、Playground、Chat、模型广场、用量日志、钱包、兑换码、订阅、任务插件、系统设置、排行榜、多语言 |
| 异步任务插件 `plugins/tasks/` | JS 插件（图片/视频/Suno 等异步任务）、插件市场、版本/激活 |
| 运维系统 | 性能监控、系统任务、多节点实例、独立日志库(ClickHouse)、通知渠道(Telegram/WeChat/UptimeKuma) |
| 附加 | Midjourney 中转、Codex 集成、Model Deployment(IoNet GPU)、vendor 管理、Electron 桌面端 |

---

## 4. 功能裁剪清单（保留 / 裁剪 / 改造）

### 4.1 保留 —— 核心中转引擎（中转站本职）

| 功能 | 说明 | 理由 |
|---|---|---|
| 协议翻译（OpenAI/Anthropic/Gemini） | Chat Completions / Responses / Messages / Gemini | 中转站核心，ADR-05 已确认 Go 充分实现 |
| RelayKit / tokenkit | 协议互转 DTO、token 计数 | 核心，独立模块保留 |
| 渠道适配器（45 家） | 国外 + 国内厂商全量保留 | 模型接入是本项目价值点 |
| 渠道路由与调度 | 优先级/权重/重试/亲和性/多密钥轮询/模型映射 | 中转站核心，ADR-06 |
| 限流 | 模型级/全局/用户级限流 | 核心 |
| 图像/音频/向量/重排/视频 | images/audio/embeddings/rerank/video | 核心协议面 |

### 4.2 保留 —— 站点用户运营（用户明确要求，不裁剪）

| 功能 | 代码位置 | 理由 |
|---|---|---|
| 兑换码 | `controller/redemption.go`、`model/redemption.go` | 用户明确保留 |
| 在线充值（易支付/Stripe/Creem/Waffo/Waffo-Pancake） | `controller/topup*.go`、`service/epay.go` | 用户明确保留 |
| 订阅套餐 | `controller/subscription*.go`、`model/subscription.go` | 用户明确保留 |
| 邀请奖励 | `controller` `/user/aff`、`/user/aff_transfer` | 用户明确保留 |
| 分组倍率 | `controller/ratio_config.go`、`/option/rest_model_ratio` | 用户明确保留 |
| 多语言控制台（7 语言） | `web/src/i18n/`、`i18n/` | 用户明确保留 |
| OAuth / OIDC（GitHub/Discord/OIDC/LinuxDO/Telegram/WeChat + 自定义） | `controller/oauth.go`、`controller/custom_oauth.go`、`oauth/` | 用户明确保留 |
| 2FA / Passkey / 登录会话 | `controller/twofa.go`、`controller/passkey.go`、`controller/auth_session.go` | 用户明确保留 |
| 签到 | `controller/checkin.go` | 运营能力，保留 |
| 用户注册/登录/会话 | `controller/user.go`、`service/auth_*` | 客户体系基础 |
| Access Token + scopes | `controller/access_token.go`、`service/access_token_scope.go` | 客户可编程访问，保留 |

### 4.3 保留 —— 客户级计量计费 + 客户管理

| 功能 | 说明 | 理由 |
|---|---|---|
| 额度/配额（用户级） | `service/quota.go`、`model/quota_reserve.go` | ADR-06 客户级计量 |
| 模型倍率 + 缓存计费 + 阶梯定价 | `model/pricing*.go`、`pkg/billingexpr/` | ADR-10 统一扣费引擎 |
| 用量日志 | `model/log.go`、`controller/log.go` | 客户级计量基础 |
| 数据看板/排行榜 | `controller/rankings.go`、`controller/dashboard.go` | 运营视角 |
| 用户/分组/令牌(apikey)管理 | `controller/user.go`、`controller/token.go`、`controller/group.go` | ADR-06「客户可拆多 apikey」 |
| 渠道管理 + 测试 + 余额 + 模型拉取 | `controller/channel*.go` | 中转站核心 |
| 模型元数据/模型广场 | `controller/model*.go` | 模型接入 |
| 审计日志 | `controller/audit.go`、`model/audit_log.go` | 运营合规 |
| Casbin 细粒度权限（管理员角色） | `service/authz/`、`model/authz_role.go` | 站点运营 |

### 4.4 裁剪 —— 对办公场景过度设计 / 非中转站本职

| 功能 | 代码位置 | 裁剪理由 |
|---|---|---|
| **Model Deployment（IoNet GPU 部署）** | `controller/deployment.go`、`/deployments` 全套路由 | GPU 模型托管部署，与「中转流量池」无关，明显过度设计 |
| **Codex 集成** | `controller/codex_usage.go`、`relay/channel/codex/`、`service/codex_*.go`、`/channel/:id/codex/*` | Codex CLI 反向代理兼容，特定工具，非中转本职 |
| **Electron 桌面端** | `electron/` 目录 | 中转站软件交付不需要桌面封装 |
| **vendor_management（厂商元数据）** | `controller/vendor_meta.go`、`model/vendor_management.go`、`/vendors` 路由 | 边缘功能，无明确价值 |
| **Telegram / WeChat 通知渠道** | `controller/telegram.go`、`controller/wechat.go`、`service/user_notify.go` | 通知渠道，可裁剪（运维可选，后续可回加） |
| **UptimeKuma 监控集成** | `controller/uptime_kuma.go` | 外部监控集成，非本职 |
| **Playground / Chat 调试页** | `web/src/routes/_authenticated/playground`、`chat`、`controller/playground.go` | 控制台调试用，对交付非必需（可裁剪，或保留精简版，见待确认） |
| **Midjourney 中转** | `controller/midjourney.go`、`relay/mjproxy_handler.go`、`/mj` 路由 | 转售绘图是真实需求，但合规风险高，建议默认裁剪、按需单独开启（见 §7 待确认） |

> **关键发现**：判定标准中的「团队内部管理 / Portal 职责」在 New API 中**没有独立可裁剪模块**。New API 的「用户 = 客户」，不存在团队→成员→角色层级；其「细粒度权限(Casbin)」是站点管理员角色权限（运营能力，保留）；「细粒度计量(per-key)」恰好就是 ADR-06 要求的「客户拆多 apikey」（保留）。因此裁剪面主要集中在「过度设计」项。

### 4.5 改造 —— 功能保留但需适配

| 改造项 | 说明 | 成本 |
|---|---|---|
| **品牌化** | 交付 Gateway 时去除 `new-api` / `QuantumNous` 标识（logo/标题/包路径/镜像名/文档），遵守 AGPL 附加署名条款（保留「Frontend design and development by New API contributors.」及原项目链接） | 中（全局字符串替换 + 前端主题） |
| **AGPL 授权合规** | 见 §6，这是商业策略决策，非代码改动 | 决策项 |
| **计量分层对齐** | 确认「Gateway 客户 = New API 用户」映射，无需改代码，但需固化约束文档 | 低 |
| **前端裁剪同步** | 裁剪 4.4 模块对应的前端页面（deployments/codex/vendor/telegram 等），保证控制台与后端一致 | 中（web 292K，删除少量页面 + 导航） |
| **部署形态固化** | 固化 SQLite 单机 + PG/MySQL 生产 + 可选 ClickHouse 日志库的交付脚本，面向「外包自运维」 | 低 |

---

## 5. 改造成本评估

| 项 | 工作量估计 | 说明 |
|---|---|---|
| 裁剪过度设计模块 | 小～中 | 删除 ~10 个 controller + 对应 model/service + 前端页面；New API 模块边界清晰，删除面干净 |
| 品牌化 | 中 | 全局字符串替换，前端主题/logo/about 页 |
| 前端裁剪同步 | 中 | 删除 4~5 个页面 + 导航项，i18n 同步 |
| 部署/文档/交付固化 | 低 | Compose/Dockerfile 已现成 |
| **合计** | **约 1~2 人周（不含授权决策）** | 相比重写 456K 行代码，可忽略 |

---

## 6. 重写 vs 改造 结论

**改造（基于 New API 二次开发），不重写。**

| 维度 | 改造 | 重写 |
|---|---|---|
| 中转核心（45 厂商 + 4 协议 + 调度） | 直接复用 | 需重建 164K Go，数月工作量 |
| 站点运营（兑换码/充值/订阅/邀请/多语言/OAuth/2FA） | 直接复用（用户要求保留，New API 全具备） | 需重建，且正是要保留的部分 |
| 控制台 UI | 复用 + 裁剪少量页面 | 需重建 292K TS |
| 风险 | **AGPLv3 授权合规** | 无授权风险，但工期/稳定性风险极高 |

### AGPLv3 授权合规（唯一重大风险）

New API 采用 **AGPLv3 + §7 附加署名条款**（见 `LICENSE` / `NOTICE`），要点：

- **AGPL 网络条款**：修改后**作为 SaaS 提供服务**，须向交互用户提供完整源码。
- **§7 附加署名**：修改版必须在界面显著位置保留署名 `Frontend design and development by New API contributors.` 与指向原项目的可见链接；不得误导来源。

对本项目的影响（需商业决策，非技术问题）：

| 交付形态 | 影响 |
|---|---|
| Gateway 独立交付给合作方（外包自运维） | 分发修改版 → 触发 AGPL 开源义务（需开源 Gateway 全部源码） |
| 我们运营的超级 Portal（SaaS） | 若 Gateway 仅作超级 Portal 的可选上游、不构成 SaaS 组成部分（ADR-03），且我们不运营 Gateway SaaS，则网络条款不直接触发；但仍需在分发时遵守署名条款 |
| 规避路径 | ① 接受 AGPL，Gateway 随同开源（与「可独立交付软件」目标兼容，商业上可接受则无碍）；② 向 New API 作者购买商业授权（README 提供 `support@quantumnous.com` 通道）；③ 重写 Gateway 数据面规避（但成本高，见上表） |

> **决策（2026-10-28）**：Gateway **接受开源**，随同 AGPLv3 发布。授权风险解除，同时带来两项红利：
> 1. 可长期跟随 New API 上游主线（fork 同步），上游新增厂商/协议能力直接继承；
> 2. 「可独立交付软件」目标与开源兼容（ADR-02/08），开源反而降低合作方自运维的采购顾虑。
>
> 仍须履行 AGPL §7 附加署名义务：界面显著位置保留署名 `Frontend design and development by New API contributors.` 与指向原项目的可见链接；不得误导来源（对应改造项「品牌化」）。

---

## 7. 风险与待确认

| 编号 | 事项 | 状态 |
|---|---|---|
| T-01 | AGPLv3 授权策略（开源 / 商业授权 / 重写） | ✅ 已决策：接受开源，Gateway 随同开源 |
| T-02 | Midjourney 中转是否保留（合规风险 vs 转售需求） | 待确认，建议默认裁剪、按需开启 |
| T-03 | Playground / Chat 调试页是否保留 | 待确认，建议裁剪（控制台调试非交付必需） |
| T-04 | 品牌化时的署名条款落地位置（关于/法律/页脚） | 随品牌化一并确定 |
| T-05 | 通知渠道（Telegram/WeChat/UptimeKuma）是否保留 | 待确认，建议裁剪 |

---

## 8. 关联

- 上游决策：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD` §4 ADR-06/07/08、§5.1、§10 D-01
- 参考调研：`LLM_API_GATEWAY_COMPARISON.MD`
- 后续待决：D-02（选型建议）、D-03（计费模式清单）、D-04（多租户细节）、D-05（接口契约）
