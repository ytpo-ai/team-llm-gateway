# API Key 成员绑定与限额聚合优化计划（API_KEY_MEMBER_BINDING）

> 本 plan 固化「apikey 与成员绑定 + 按成员已绑定 apikey 聚合判断限额」的工程方案。
>
> - 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-06/09/10）、`docs/technical/db_schema/API_KEY_SCHEMA.MD`
> - 上游 plan：`docs/plan/API_KEY_PLAN.md`、`docs/plan/TEAM_MANAGEMENT_OPTIMIZATION_PLAN.md`
> - 定稿时间：2026-11-03
> - 状态：in-progress（进行中）

---

## 1. 需求背景

apikey 是下发给团队成员接入 LLM 的凭证。现状：`ApiKey` 虽已有 `userId` 归属字段，但签发时写死为当前登录成员（`persistKey` 的 `userId: user.id`），`CreateApiKeyDto`/`UpdateApiKeyDto` 均无 `userId` 入参，导致 `team_admin` 无法为指定成员签发/改绑 key。

限额判定方面：成员周期限额（日/周/月）已在 `proxy.service.ts` 按 `sumTokens({ userId })` 聚合；但**速率限制**在 `quota-limit.service.ts` 用 `minOrNull(member, key)` 合并后，`rate-limit.service.ts` 以 `apiKeyId` 为键按单 key 计数——成员拥有 N 把 key 即可获得 N 倍速率，未做到「按用户已绑定 apikey 聚合判断成员是否触发限制」。

## 2. 目标

1. 支持 apikey 与成员显式绑定：`team_admin`/`system` 可为本团队任意成员签发/改绑 key，`member` 仅可绑定自己。
2. 成员级速率限制改为按成员聚合（以 `userId` 计数），key 级速率限制仍按 `apiKeyId` 计数，两档独立校验。
3. 成员周期限额维持按 `userId` 聚合（现状正确，保持并覆盖测试）。
4. `ApiKeyView` 补充绑定成员展示信息（`userName`/`email`）。
5. 前端 API Key 管理支持选择绑定成员，列表展示绑定成员。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 绑定字段 | `CreateApiKeyDto`/`UpdateApiKeyDto` 增加可选 `userId`（`@IsMongoId`）；缺省回退为当前用户 |
| 归属校验 | 签发/改绑时校验目标成员存在且 `tenantId`/`teamId` 与当前上下文一致，防越权跨团队绑定 |
| RBAC | `member` 仅能绑定自己（`userId` 必须等于 `user.id`）；`team_admin`/`system` 可绑定本团队任意成员 |
| 速率拆分 | `quota-limit.service.ts` 返回 `memberRateLimitPerMinute`（RoleTemplate）与 `keyRateLimitPerMinute`（ApiKey）两档；`proxy.service.ts` 分别以 `userId` 与 `apiKeyId` 为键调用 `rate-limit.service.ts` |
| 成员聚合 | 成员速率以 `userId` 为键，天然聚合该成员所有已绑定 key；周期限额沿用 `sumTokens({ userId })` |
| 视图 | `ApiKeyView` 增加 `userName`/`userEmail`（`list` 时批量填充） |

> 演进说明：本 plan 的「速率拆分（member/key 两档）」实现，后续被 `docs/plan/BILLING_QUOTA_POLICY_PLAN.md` 的策略化（PolicySet）重构吸收——速率限制现由 `PolicySet` 的 `request/minute` 条目按 team/role/key 三级求值（成员级仍按 `userId` 聚合），`QuotaLimitService` 已重写为通用策略求值引擎。成员绑定（`userId` 签发/改绑 + `userName`/`userEmail`）部分保持不变。

## 4. Requirement 拆解

| Requirement | 内容 | 主要涉及 feature | 验收条件 |
|---|---|---|---|
| [API_KEY_REQ-003](../requirement/API_KEY_REQ-003_BACKEND_MEMBER_BINDING.md) | 后端：userId 绑定入参 + 归属校验 + 成员级速率按 userId 聚合 + ApiKeyView 成员信息 | api_key、billing_quota、usage_metering | team_admin 可为成员签发/改绑 key；成员多 key 速率共享上限；成员周期限额聚合正确；lint/typecheck/test 通过 |
| [API_KEY_REQ-004](../requirement/API_KEY_REQ-004_FRONTEND_MEMBER_BINDING.md) | 前端：成员选择器 + 列表展示绑定成员 | api_key | team_admin 创建/编辑可选成员；列表展示绑定成员名；build 通过 |

## 5. 里程碑

1. ✅ REQ-003 后端成员绑定 + 成员级速率聚合。
2. ✅ REQ-004 前端成员选择器与展示。

## 6. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| B-01 | 速率限流由「按 key」改为「按成员聚合」后，成员多 key 场景更严格 | 已确认符合预期 |
| B-02 | `RateLimitService` 为进程内 Map，多实例部署不共享（既有风险） | 本期不改，仅记录 |
| B-03 | `UpdateApiKeyDto.userId` 改绑成员是否影响已产生用量归属 | 改绑后新用量记新 `userId`，历史用量归属不变（按 UsageLog 已固化 userId/apiKeyId） |
| B-04 | 成员周期限额「按 userId 聚合」与「按已绑定 apikey 聚合」等价性 | 因每次用量同时记录 userId+apiKeyId，两者等价，本期沿用 userId 聚合 |

## 7. 关联

- 上游：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`、`API_KEY_PLAN.md`、`TEAM_MANAGEMENT_OPTIMIZATION_PLAN.md`
- feature：`docs/feature/api_key.md`、`billing_quota.md`、`usage_metering.md`
- 数据模型：`docs/technical/db_schema/API_KEY_SCHEMA.MD`、`BILLING_QUOTA_SCHEMA.MD`
- requirement：见 §4
