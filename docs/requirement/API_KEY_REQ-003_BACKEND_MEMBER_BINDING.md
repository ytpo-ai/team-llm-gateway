# API_KEY_REQ-003 后端成员绑定与成员级速率聚合

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/api_key.md`（主）、`docs/feature/billing_quota.md`、`docs/feature/usage_metering.md` |
| 所属 plan | `docs/plan/API_KEY_MEMBER_BINDING_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/api-key-member-binding` |
| 状态 | `in-review` |

## 2. 需求描述

### 背景
apikey 是下发给团队成员接入 LLM 的凭证。现状签发写死为当前登录成员，`team_admin` 无法为指定成员签发/改绑 key；成员速率限制按单 key 计数，成员多 key 时速率上限被绕过。

### 目标
- `CreateApiKeyDto`/`UpdateApiKeyDto` 增加可选 `userId`，支持绑定/改绑成员。
- 归属校验：目标成员必须同租户同团队；`member` 仅能绑定自己，`team_admin`/`system` 绑定本团队任意成员。
- 成员级速率限制按 `userId` 聚合计数，key 级速率限制按 `apiKeyId` 计数，两档独立校验。
- `ApiKeyView` 增加 `userName`/`userEmail`，`list` 批量填充。

### 验收条件
- [ ] team_admin 可为本团队成员签发 key 且 `userId` 生效。
- [ ] 越权绑定（跨团队/不存在成员）返回错误；member 不能绑定他人。
- [ ] 成员多 key 时，成员速率上限按成员聚合，不再按单 key 放大。
- [ ] 成员周期限额仍按成员聚合（不被破坏）。
- [ ] `GET /api-keys` 返回 `userName`/`userEmail`。
- [ ] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过。

## 3. 技术方案摘要
- 改 `api-keys/dto`、`api-keys.service.ts`（绑定校验 + 填充成员信息）。
- 改 `billing/quota-limit.service.ts`（拆分 member/key 两档速率）、`proxy/proxy.service.ts`（分别按 userId/apiKeyId 限流）、`proxy/rate-limit.service.ts`。
- 更新 `docs/technical/db_schema/API_KEY_SCHEMA.MD`、`BILLING_QUOTA_SCHEMA.MD`。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/API_KEY_REQ-003_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [ ] 已交付
