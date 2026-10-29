# 模型与上游模块开发计划（MODEL_PROVIDER）

> 本 plan 固化 Portal 业务模块 **模型与上游（model_provider）** 的工程方案，落地 ADR-09「方案 A」的上游侧（团队上游渠道 + 模型目录），为下游 `usage_metering`（倍率×token 计量）、`billing_quota`（扣费引擎）、`model_recommendation`（能力标签选型）提供基础数据。
>
> - 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-03/06/09/10、§3 核心解耦原则、§5.2、D-05）
> - 上游 plan：`docs/plan/API_KEY_PLAN.md`（API Key 已交付，其 `allowedModels` 白名单将引用本模块模型目录）
> - 定稿时间：2026-10-28
> - 状态：已批准

---

## 1. 需求背景

`api_key` 已交付，但 key 的 `allowedModels` 模型白名单目前是自由文本，无模型目录支撑。计量（成本 = 模型倍率 × token）、计费（统一扣费引擎）、选型建议（能力标签匹配）都依赖「模型目录 + 上游渠道」。现落地「模型与上游」模块：团队配置上游渠道（baseUrl + 上游 key，加密存储），维护模型目录（倍率 + 能力标签 + 别名），为下游模块提供单一事实来源。

## 2. 目标

1. 新增 `Provider`（上游渠道）实体：`baseUrl` + `apiKey`（AES-256-GCM 加密落库，仅展示脱敏 hint）+ `type` + `status`。
2. 新增 `Model`（模型目录）实体：`modelId` + `displayName` + `multiplier`（倍率）+ `capabilities`（能力标签）+ `aliases` + `providerId`。
3. RBAC：渠道/模型写操作仅 `team_admin`；模型目录读所有成员；渠道（含敏感上游 key）仅 `team_admin` 可见。
4. 前端：上游管理页 + 模型目录页。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 数据模型 | 新增 `Provider`、`Model` 两个集合；详见 `docs/technical/db_schema/MODEL_PROVIDER_SCHEMA.MD` |
| 上游抽象 | 核心解耦原则（§3）：上游统一为「OpenAI 兼容」一种抽象；`type` 枚举保留 `openai-compatible`（默认，覆盖 OpenAI/Gateway/第三方中转）与 `anthropic`（直连，协议翻译后续） |
| key 加密 | node:crypto `aes-256-gcm`，密钥 = sha256(`ENCRYPTION_SECRET`)，密文 = `iv.tag.ciphertext`（base64url 拼接）落库；明文 key 绝不落库、绝不返回，仅创建/更新时输入 |
| key 脱敏 | `apiKeyHint` = 前缀 3 字符 + `***` + 末 4 字符，仅用于列表展示 |
| 团队隔离 | `Provider`/`Model` 均携带 `tenantId` / `teamId`，查询按 `tenantId + teamId` 过滤（团队级资源） |
| 鉴权 | 复用 `JwtAuthGuard` / `RolesGuard` / `@Roles()` / `@CurrentUser()`；RBAC 见 §4 |

## 4. RBAC 设计

| 资源 | 读 | 写（创建/更新/删除） |
|---|---|---|
| `providers`（上游渠道，含敏感 key） | `team_admin` | `team_admin` |
| `models`（模型目录） | 所有成员（`member`/`finance`/`viewer`/`team_admin`） | `team_admin` |

- 删除为软删除语义：`status: active → disabled`，不物理删除。
- 上游 key 永不对外返回明文，列表/详情仅返回 `apiKeyHint`。

## 5. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [MODEL_PROVIDER_REQ-001](../requirement/MODEL_PROVIDER_REQ-001_BACKEND_PROVIDER_MODEL.md) | 后端：Provider/Model schema、providers/models 模块 CRUD、AES-256-GCM 加密、RBAC、租户/团队隔离 | `start:dev` 启动，Swagger 可调 providers/models 各接口，Mongo 落库仅存密文，lint/typecheck/test 通过 |
| [MODEL_PROVIDER_REQ-002](../requirement/MODEL_PROVIDER_REQ-002_FRONTEND_PROVIDER_MODEL.md) | 前端：上游管理页 + 模型目录页、路由 `/providers`/`/models`、导航接入 | `dev`/`build` 通过，创建→列表可见→编辑→删除闭环可用，上游 key 仅显示脱敏 hint |

## 6. 里程碑

1. ✅ REQ-001 后端模型与上游（本文档拆解）。
2. ✅ REQ-002 前端上游/模型管理闭环。
3. ✅ OpenAI 兼容转发层（`/v1/*` 代理 + key 校验 + provider 解析 + SSE 流式 + 协议翻译），与 `usage_metering` 计量联动交付（见 `docs/plan/USAGE_METERING_PLAN.md`）。

## 7. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| M-01 | OpenAI 兼容转发层（成员 key → Portal → 上游 key 转发） | ✅ 已交付（`docs/plan/USAGE_METERING_PLAN.md` REQ-002，含 key 校验 + provider 解析 + SSE + 计量联动） |
| M-02 | Anthropic 协议翻译 | 首期仅落 `type` 枚举位，`openai-compatible` 为默认，翻译逻辑后续 |
| M-03 | 上游连通性探活（`POST /providers/:id/test`） | 后续 |
| M-04 | 上游 key 加密密钥管理（KMS / 轮换） | 首期 `ENCRYPTION_SECRET` 环境变量，密钥轮换留待后续 |
| M-05 | 模型目录归属粒度（团队级 vs 租户级 vs 全局） | 首期团队级（`tenantId + teamId`），随多团队演进再评估租户级共享 |

## 8. 关联

- 上游：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`、`API_KEY_PLAN.md`
- feature：`docs/feature/model_provider.md`
- 数据模型：`docs/technical/db_schema/MODEL_PROVIDER_SCHEMA.MD`（本 plan 新增）
- requirement：见 §5
