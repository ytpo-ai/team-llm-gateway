# TEAM_MANAGEMENT_REQ-002 开发记录（三级限额模型）

> 对应需求：`docs/requirement/TEAM_MANAGEMENT_REQ-002_QUOTA_LIMIT.md`
> 对应计划：`docs/plan/TEAM_MANAGEMENT_OPTIMIZATION_PLAN.md`
> 分支：`main`（提交 `0a313b4`）

## 1. 实现摘要

落地「团队 / 成员 / apikey 三级日/周/月使用限额 + 渠道白名单」，余额与限额分离：

- `Team`/`ApiKey` 新增 `limitDaily`/`limitWeekly`/`limitMonthly` 与 `providerIds` 渠道白名单。
- 新增 `QuotaLimitService`：解析团队限额、成员继承角色B 模板、速率取成员与 key 最小值，并提供渠道/模型白名单判定。
- 转发层 `ProxyService` 逐级校验团队/成员/key 的日/周/月限额（任一超标拦截，自然日/周/月窗口）。
- 余额账户维持 team/member 两级（成员优先扣、团队兜底），apikey 只限额不持余额。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `modules/billing/quota-limit.service.ts` | `resolve`（解析三级限额/速率）、`resolveMemberTemplate`、`isProviderAllowed`、`isModelAllowed` |
| `modules/billing/quota-limit.service.spec.ts` | 单测（10 例） |

### 修改

| 文件 | 说明 |
|---|---|
| `modules/teams/schemas/team.schema.ts` | `limitDaily/Weekly/Monthly` + `providerIds` |
| `modules/api-keys/schemas/api-key.schema.ts` | `limitDaily/Weekly/Monthly` + `providerIds` |
| `modules/api-keys/dto/*.ts` | `Create/UpdateApiKeyDto` 增加限额与渠道白名单字段 |
| `modules/api-keys/api-keys.service.ts` | `persistKey`/`update`/`rotate`/`toView` 处理新字段 |
| `modules/usage/usage.service.ts` | 新增 `sumTokens`（按团队/成员/key + 时间窗口聚合） |
| `modules/proxy/proxy.service.ts` | `enforceLimits` 三级逐级限额校验 + 渠道/模型白名单校验 + 窗口计算 |
| `modules/billing/billing.module.ts` | 注册 `Team`/`RoleTemplate` model + `QuotaLimitService` |
| `modules/teams/dto/update-team.dto.ts` | 增加限额字段 |
| `modules/teams/teams.service.ts` | `updateTeam`（名称/限额/渠道白名单）+ `TeamView` 扩展 |
| `modules/teams/teams.controller.ts` | `PATCH /teams/:teamId` 改为 updateTeam |
| `frontend/src/features/api-keys/{api,types}.ts`、`pages/api-keys.tsx` | API Key 表单支持日/周/月限额 |
| `frontend/src/features/teams/{api,types}.ts`、`pages/team.tsx` | 团队限额配置卡片 |

## 3. 踩坑记录

1. **「取最小值」的正确实现是逐级校验**：若仅取 min 数值再查单一累计范围，会漏掉「更宽层级已超限」的情况（如团队限额 500、成员限额 2000，仅查团队会漏掉成员 3000 超限）。正确做法是团队/成员/key 各自按对应累计范围独立校验，等价于「任一超标即拦截」。
2. **窗口口径**：日/周/月按 UTC 自然周期（`startOfDay`/`startOfWeek` 周一起算/`startOfMonth`），保证跨时区一致。
3. **`ApiKeyContext.apiKey` 类型**：guard 实际注入的是 `ApiKeyDocument`，但装饰器接口声明为 `ApiKey`。`QuotaLimitService` 只需读字段，参数用 `ApiKey`（class）类型即可，避免引入 Document 泛型导致 spec mock 复杂化。
4. **spec 需同步 mock 新增字段**：`ApiKey`/`Team` schema 加字段后，`proxy`/`api-keys`/`teams` 的 spec mock 与 `toEqual` 断言需同步补齐，否则编译/断言失败。

## 4. 验证结果

- `pnpm --filter portal-backend lint`：0 errors / 0 warnings。
- `pnpm --filter portal-backend typecheck`：通过。
- `pnpm --filter portal-backend test`：96 passed。
- `pnpm --filter portal-frontend typecheck` / `build`：通过。

## 5. 关联

- feature：`docs/feature/billing_quota.md`、`api_key.md`
- 数据模型：`docs/technical/db_schema/BILLING_QUOTA_SCHEMA.MD`、`API_KEY_SCHEMA.MD`、`TEAM_MEMBER_SCHEMA.MD`
- 待决事项：T-01（单成员限额 override）见 plan §6。
