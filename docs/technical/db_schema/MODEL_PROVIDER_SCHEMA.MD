# 模型与上游数据模型（Provider / Model）

> 所属模块：`docs/feature/model_provider.md`；上游 plan：`docs/plan/MODEL_PROVIDER_PLAN.md`
>
> 本文件固化 `Provider`（上游渠道）与 `Model`（模型目录）的 Mongoose Schema 定义，作为「模型与上游」模块的单一事实来源。下游模块（usage_metering / billing_quota / model_recommendation / 转发层）引用此处的倍率、能力标签与上游配置。

---

## 1. 设计原则

- **多租户内建（ADR-03）**：两集合均携带 `tenantId` + `teamId`，查询按 `tenantId + teamId` 过滤（团队级资源）。
- **核心解耦（§3）**：上游统一为「OpenAI 兼容」抽象；`type` 枚举保留 `anthropic` 位用于直连（协议翻译后续）。
- **上游 key 加密**：`apiKey` 以 AES-256-GCM 密文落库，明文 key 绝不落库、绝不对外返回；仅创建/更新时输入，展示仅 `apiKeyHint`。
- **模型倍率（ADR-10）**：`multiplier` 是扣费引擎（模型倍率 × token）的唯一基准。
- **能力标签（§8 选型建议）**：`capabilities` 供 `model_recommendation` 做场景匹配。

## 2. Provider（上游渠道）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `_id` | ObjectId | 主键 | 自动生成 |
| `tenantId` | ObjectId | 必填、ref `Tenant`、索引 | 所属租户 |
| `teamId` | ObjectId | 必填、ref `Team`、索引 | 所属团队 |
| `name` | string | 必填、trim | 渠道名称（如「OpenAI 直连」） |
| `type` | enum | `openai-compatible` / `anthropic`，默认 `openai-compatible` | 上游协议类型 |
| `baseUrl` | string | 必填、trim | 上游 API 端点（如 `https://api.openai.com/v1`） |
| `apiKeyCiphertext` | string | 必填 | 上游 key 的 AES-256-GCM 密文（`iv.tag.ciphertext`） |
| `apiKeyHint` | string | 必填 | 脱敏展示（前缀 3 + `***` + 末 4） |
| `status` | enum | `active` / `disabled`，默认 `active` | 渠道状态 |
| `createdAt` | Date | 自动 | 创建时间 |
| `updatedAt` | Date | 自动 | 更新时间 |

**索引**：
- 唯一索引 `{ tenantId: 1, teamId: 1, name: 1 }`，同一团队渠道名唯一。
- 普通索引 `{ tenantId: 1, teamId: 1 }`，支撑按团队列表查询。

## 3. Model（模型目录）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `_id` | ObjectId | 主键 | 自动生成 |
| `tenantId` | ObjectId | 必填、ref `Tenant`、索引 | 所属租户 |
| `teamId` | ObjectId | 必填、ref `Team`、索引 | 所属团队 |
| `providerId` | ObjectId | 必填、ref `Provider`、索引 | 归属上游渠道 |
| `modelId` | string | 必填、trim | 模型标识（如 `gpt-4o-mini`） |
| `displayName` | string | 可选、trim、默认 `''` | 展示名（如 `GPT-4o mini`） |
| `description` | string | 可选、trim、默认 `''` | 模型简介（卡片展示） |
| `contextLength` | number \| null | 可选、默认 `null` | 上下文长度（tokens） |
| `maxOutputLength` | number \| null | 可选、默认 `null` | 最大输出长度（tokens） |
| `inputModalities` | string[] | 可选、默认 `['text']` | 输入模态（约定取值 `text`/`image`/`audio`/`video`） |
| `outputModalities` | string[] | 可选、默认 `['text']` | 输出模态（约定取值同上） |
| `multiplier` | number | 必填、默认 `1` | 计费倍率（模型倍率 × token） |
| `capabilities` | string[] | 可选、默认 `[]` | 能力标签（如 `code`/`chat`/`vision`/`reasoning`） |
| `aliases` | string[] | 可选、默认 `[]` | 模型别名（映射到 `modelId`） |
| `status` | enum | `active` / `disabled`，默认 `active` | 模型状态 |
| `createdAt` | Date | 自动 | 创建时间 |
| `updatedAt` | Date | 自动 | 更新时间 |

**索引**：
- 唯一索引 `{ tenantId: 1, teamId: 1, modelId: 1 }`，同一团队模型标识唯一。
- 普通索引 `{ tenantId: 1, teamId: 1, providerId: 1 }`，支撑按渠道查模型。

## 4. 上游 key 加密规则

```ts
const ALGO = 'aes-256-gcm';
const key = createHash('sha256').update(ENCRYPTION_SECRET).digest(); // 32-byte
const iv = randomBytes(12);
// ciphertext + authTag
const payload = `${iv.b64url}.${tag.b64url}.${ciphertext.b64url}`; // 落库
```

- 明文 key 仅在 `POST /providers`、`PATCH /providers/:id`（提供新 key 时）输入。
- 解密仅在后续转发层（运行时）内部进行，任何管理接口不返回明文。

## 5. 脱敏视图

```ts
interface ProviderView {
  id: string;
  name: string;
  type: 'openai-compatible' | 'anthropic';
  baseUrl: string;
  apiKeyHint: string;   // 仅脱敏，不含明文/密文
  status: 'active' | 'disabled';
  createdAt?: Date;
}

interface ModelView {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  description: string;
  contextLength: number | null;
  maxOutputLength: number | null;
  inputModalities: string[];
  outputModalities: string[];
  multiplier: number;
  capabilities: string[];
  aliases: string[];
  status: 'active' | 'disabled';
  createdAt?: Date;
}
```

## 6. 状态流转

```
(创建) ──► active ──(DELETE 删除)──► disabled
```

- 删除为软删除（`status: disabled`），保留记录供计量/审计追溯。
