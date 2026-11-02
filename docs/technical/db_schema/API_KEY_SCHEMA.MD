# API Key 管理数据模型（ApiKey）

> 所属模块：`docs/feature/api_key.md`；上游 plan：`docs/plan/API_KEY_PLAN.md`
>
> 本文件固化 `ApiKey` 的 Mongoose Schema 定义，作为 API Key 管理模块的单一事实来源。下游模块（usage_metering / model_provider / 代理路由层）引用此处的 key 归属与限制字段。

---

## 1. 设计原则

- **多租户内建（ADR-03）**：`ApiKey` 携带 `tenantId` 引用 `Tenant`，查询一律按 `tenantId` 过滤。
- **key 归属成员（ADR-06）**：`tenantId → teamId → userId` 三级归属，用量归到成员/团队。
- **哈希存储**：只落 `keyHash`（sha256）与 `keyPrefix`（展示前缀），明文 key 绝不落库；完整值仅在创建/轮换时返回一次。
- **细粒度限制（ADR-06/09）**：每 key 独立 `allowedModels` / `rateLimitPerMinute` / `maxTokens` / `limitDaily` / `limitWeekly` / `limitMonthly` / `providerIds` / `expiresAt`。
- **三级限额（团队管理优化 REQ-002）**：apikey 只设限额、不持余额；转发层对团队/成员/key 三级日/周/月限额逐级校验，任一超标即拦截。

## 2. ApiKey（API 密钥）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `_id` | ObjectId | 主键 | 自动生成 |
| `tenantId` | ObjectId | 必填、ref `Tenant`、索引 | 所属租户 |
| `teamId` | ObjectId | 必填、ref `Team`、索引 | 所属团队 |
| `userId` | ObjectId | 必填、ref `User`、索引 | 归属成员 |
| `name` | string | 可选、trim | key 标签（如「我的开发密钥」） |
| `keyHash` | string | 必填、唯一索引 | 完整 key 的 sha256 哈希 |
| `keyPrefix` | string | 必填 | 展示前缀（如 `pk_ab12cd34ef`，12 字符） |
| `status` | enum | `active` / `revoked`，默认 `active` | key 状态 |
| `expiresAt` | Date | 可选 | 过期时间；`null` = 永久有效 |
| `allowedModels` | string[] | 可选 | 模型白名单；空/缺省 = 不限制 |
| `rateLimitPerMinute` | number | 可选 | 每分钟请求速率上限；缺省 = 不限制 |
| `maxTokens` | number | 可选 | token 预算上限（总用量）；缺省 = 不限制 |
| `limitDaily` | number | 可选 | 日 token 上限（自然日窗口）；缺省 = 不限制 |
| `limitWeekly` | number | 可选 | 周 token 上限（自然周窗口）；缺省 = 不限制 |
| `limitMonthly` | number | 可选 | 月 token 上限（自然月窗口）；缺省 = 不限制 |
| `providerIds` | ObjectId[] | 可选、ref `Provider` | 可用渠道白名单；空 = 全部渠道 |
| `lastUsedAt` | Date | 可选 | 最近使用时间（下游计量写入） |
| `createdAt` | Date | 自动 | 创建时间 |
| `updatedAt` | Date | 自动 | 更新时间 |

**索引**：
- 唯一索引 `{ keyHash: 1 }`，保证 key 哈希全局唯一。
- 普通索引 `{ tenantId: 1, userId: 1 }`、`{ teamId: 1 }`，支撑按成员/团队列表查询。

## 3. key 生成规则

```ts
const key = `pk_${randomBytes(24).toString('base64url')}`;      // 完整值，仅返回一次
const keyHash = createHash('sha256').update(key).digest('hex'); // 落库
const keyPrefix = key.slice(0, 12);                              // 列表展示
```

- 前缀 `pk_` 用于识别 Portal 签发的成员 key，区别于上游厂商 key。
- 完整 key 仅在 `POST /api-keys`、`POST /api-keys/:id/rotate` 响应中返回一次，后续仅返回脱敏视图（`keyPrefix`）。

## 4. 脱敏视图（ApiKeyView）

对外（列表/详情）一律返回：

```ts
interface ApiKeyView {
  id: string;
  name: string | null;
  keyPrefix: string;          // 仅前缀，不含完整值
  status: 'active' | 'revoked';
  expiresAt: Date | null;
  allowedModels: string[];
  rateLimitPerMinute: number | null;
  maxTokens: number | null;
  limitDaily: number | null;
  limitWeekly: number | null;
  limitMonthly: number | null;
  providerIds: string[];
  lastUsedAt: Date | null;
  userId: string;
  createdAt?: Date;
}
```

- 完整 key 值只出现在创建/轮换的 `{ apiKey: ApiKeyView, key: string }` 响应中。

## 5. 状态流转

```
(创建) ──► active ──(DELETE 吊销)──► revoked
              │
              └──(rotate 轮换)──► 新建 active + 旧 key ─► revoked
```

- 吊销为软删除（`status: revoked`），保留记录供计量/审计追溯。
- `revoked` 状态的 key 不可再被使用，也不可恢复为 `active`。
