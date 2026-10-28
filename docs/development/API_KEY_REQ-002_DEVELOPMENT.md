# API_KEY_REQ-002 开发记录（前端 API Key 管理）

> 对应需求：`docs/requirement/API_KEY_REQ-002_FRONTEND_KEY.md`
> 对应计划：`docs/plan/API_KEY_PLAN.md`
> 分支：`feat/api-key-frontend`（提交 `30fd84d`）

## 1. 实现摘要

落地 API Key 管理前端界面，对接 REQ-001 后端接口，复用认证闭环（`features/auth` + `lib/http` 的 `request<T>`）：

- 页面 `pages/api-keys.tsx`：Key 列表（名称/keyPrefix/状态/限制/过期/最近使用）+ 创建与编辑共用表单 + 一次性完整 key 展示与复制 + 吊销/轮换。
- `features/api-keys`（types/api）：接口封装与类型（`ApiKey`/`ApiKeyResult`/`ApiKeyInput`/`ApiKeyPatch`）。
- 路由与导航：新增 `/api-keys`（受保护）；导航栏接入「概览 / 团队 / API Key」。
- 限制字段表单化：模型白名单（逗号分隔）、速率（次/分钟）、预算（tokens）、过期时间（date 输入），空值 = 不限/永久。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `features/api-keys/types.ts` | `ApiKey` / `ApiKeyResult` / `ApiKeyInput` / `ApiKeyPatch` |
| `features/api-keys/api.ts` | `listApiKeys` / `createApiKey` / `updateApiKey` / `revokeApiKey` / `rotateApiKey` |
| `pages/api-keys.tsx` | API Key 管理页（TanStack Query + 创建/编辑表单 + 一次性 key 展示 + 吊销/轮换） |

### 修改

| 文件 | 说明 |
|---|---|
| `router.tsx` | 新增 `/api-keys`（受保护）路由 |
| `components/layout/app-layout.tsx` | 导航栏接入「API Key」 |

## 3. 踩坑记录

1. **创建与编辑的「空值」语义差异**：创建时空字段应「不传」（后端缺省 = 不限/永久），编辑时空字段应「传 null」（清除限制）。故分别构建 `ApiKeyInput`（空 → `undefined`）与 `ApiKeyPatch`（空 → `null`），避免编辑时无法清除已有限制。
2. **一次性 key 展示**：完整 key 仅在创建/轮换响应中返回一次，故用独立 `revealed` 状态渲染提示卡片，关闭即丢弃；列表/编辑一律只消费 `keyPrefix`，避免误把完整值持久化到组件状态。
3. **number 输入的字符串态**：`Input type="number"` 值以字符串维护，提交时 `Number()` 转换并做空值守卫，避免 `Number('') === 0` 被误判为 0。

## 4. 验证结果

- `pnpm --filter portal-frontend lint`：0 errors（1 条 theme-provider 既有 warning，非本次改动）。
- `pnpm --filter portal-frontend typecheck`：通过。
- `pnpm --filter portal-frontend build`：通过（2031 modules，gzip 126.3 kB）。
- 后端契约（REQ-001）：创建返回 `{ apiKey, key }`，列表/详情仅返回 `keyPrefix`；前端通过 React Query 对接同一契约，覆盖「创建 → 展示完整 key → 复制 → 列表可见 → 编辑限制 → 吊销/轮换」闭环。

## 5. 关联

- feature：`docs/feature/api_key.md`
- 后端契约：REQ-001（`docs/development/API_KEY_REQ-001_DEVELOPMENT.md`）
- 待决事项：A-04（key 前缀兼容性，如后续需 `sk-`）见 `docs/plan/API_KEY_PLAN.md` §7。
