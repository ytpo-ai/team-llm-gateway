# TEAM_MANAGEMENT_REQ-002 三级限额模型

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/billing_quota.md`（主）、`docs/feature/api_key.md` |
| 所属 plan | `docs/plan/TEAM_MANAGEMENT_OPTIMIZATION_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/team-management-quota-limit` |
| 状态 | `in-review` |

## 2. 需求描述

### 背景
现有计费仅团队/成员两级余额账户（按月），apikey 仅有 `model 白名单`/`rateLimitPerMinute`/`maxTokens budget`/`过期`。本次落地「团队 / 成员 / apikey 三级日/周/月使用限额 + 渠道白名单」，生效值取最严格，成员限额继承角色B。

### 目标
- 限额（日/周/月）在团队 / 成员 / apikey 三级各自设置，转发层校验**生效值 = min(团队, 成员, key)**。
- 余额账户维持仅团队/成员两级（成员优先扣、团队兜底），apikey 只限额不持余额。
- 成员限额默认继承角色B 模板（`limitDaily`/`limitWeekly`/`limitMonthly`/`rateLimitPerMinute`），本期不支持单成员覆盖（预留 override 扩展点）。
- 渠道白名单：团队 / 成员 / key 三级 `providerIds`（渠道 = Provider）限制。
- 转发层（`proxy`）在请求前校验限额与渠道白名单，超额拦截。

### 验收条件
- [ ] 团队/成员/key 三级日/周/月限额均可配置。
- [ ] 转发请求时，任一级限额超额即拦截（min 生效）。
- [ ] 成员绑定角色B 后继承其限额与渠道白名单。
- [ ] apikey 限额 + 模型/渠道白名单生效。
- [ ] 余额扣减逻辑不变（成员优先、团队兜底）。
- [ ] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过。

## 3. 技术方案摘要
- 复用 `billing_quota` 扣费引擎与 `proxy` 转发层既有校验链路。
- 数据模型更新 `BILLING_QUOTA_SCHEMA.MD`、`API_KEY_SCHEMA.MD`；新增三级限额与渠道白名单字段。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/TEAM_MANAGEMENT_REQ-002_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [ ] 已交付
