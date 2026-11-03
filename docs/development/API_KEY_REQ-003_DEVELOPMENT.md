# API_KEY_REQ-003 开发记录（后端成员绑定与成员级速率聚合）

> 对应需求：`docs/requirement/API_KEY_REQ-003_BACKEND_MEMBER_BINDING.md`
> 对应计划：`docs/plan/API_KEY_MEMBER_BINDING_PLAN.md`
> 分支：`feat/api-key-member-binding`（提交 `18acea4`）

## 1. 实现摘要

落地「apikey 与成员绑定 + 按成员已绑定 apikey 聚合判断限额」：

- 绑定入参：`CreateApiKeyDto`/`UpdateApiKeyDto` 新增可选 `userId`（`@IsMongoId`），缺省回退当前用户。
- 归属校验：`ApiKeysService.resolveTargetUserId` 校验目标成员同租户同团队；`member` 仅能绑定自己，`team_admin`/`system` 绑定本团队任意成员；跨团队/不存在返回 `NotFoundException`。
- 轮换语义：`rotate` 保留旧 key 的 `userId`（不再回落到创建者）。
- 视图：`ApiKeyView` 新增 `userName`/`userEmail`；`list` 用 `UsersService.findByIds` 批量填充，单条（get/create/update/revoke/rotate）按需 `findById` 填充。
- 速率聚合：`QuotaLimitService.resolve` 拆分 `memberRateLimitPerMinute`（角色B 模板）与 `keyRateLimitPerMinute`（key）；`ProxyService` 分别以 `userId` 与 `apiKeyId` 为键独立调用 `RateLimitService.assertAllowed`，成员多 key 共享成员级速率上限。

## 2. 代码改动点

### 修改

| 文件 | 说明 |
|---|---|
| `modules/api-keys/dto/create-api-key.dto.ts` | 新增 `userId` 入参 |
| `modules/api-keys/dto/update-api-key.dto.ts` | 新增 `userId` 改绑入参 |
| `modules/api-keys/api-keys.service.ts` | 绑定校验、rotate 保留 userId、`ApiKeyView` 成员信息填充 |
| `modules/api-keys/api-keys.module.ts` | 导入 `UsersModule` |
| `modules/users/users.service.ts` | 新增 `findByIds` |
| `modules/billing/quota-limit.service.ts` | 拆分成员级/key 级速率，移除 `minOrNull` |
| `modules/proxy/proxy.service.ts` | 成员级（userId）/key 级（apiKeyId）两档速率独立限流 |

### 测试

| 文件 | 说明 |
|---|---|
| `api-keys.service.spec.ts` | 新增绑定用例（team_admin 绑定成员、member 越权、跨团队拒绝）+ UsersService mock |
| `quota-limit.service.spec.ts` | 更新 `resolve` 拆分断言 |
| `proxy.service.spec.ts` | 新增「成员级按 userId、key 级按 apiKeyId 限流」断言 |

## 3. 踩坑记录

1. **成员速率合并 vs 拆分**：原实现 `minOrNull(member, key)` 合并后按单 key 计数，导致成员多 key 时速率被绕过。改为两档独立校验，成员级以 `userId` 聚合（成员所有 key 共享上限），key 级以 `apiKeyId` 计数。
2. **绑定校验的 teamId 边界**：`system` 角色可能无 `teamId`，因此 `resolveTargetUserId` 仅在 `user.teamId != null` 时校验目标成员同团队，否则只校验同租户。
3. **视图填充 N+1**：单条视图按需 `findById`，列表用 `findByIds` 批量填充，避免列表逐条查询。

## 4. 验证结果

- `pnpm --filter portal-backend lint`：0 errors / 0 warnings。
- `pnpm --filter portal-backend typecheck`：通过。
- `pnpm --filter portal-backend test`：142 passed。
- 覆盖：绑定（team_admin 指定成员、member 越权、跨团队拒绝）、速率拆分与按 userId/apiKeyId 独立限流。

## 5. 关联

- feature：`docs/feature/api_key.md`、`docs/feature/billing_quota.md`
- 数据模型：`docs/technical/db_schema/API_KEY_SCHEMA.MD`、`docs/technical/db_schema/BILLING_QUOTA_SCHEMA.MD`
- 风险：B-01（成员多 key 速率更严格，已确认）、B-02（RateLimitService 进程内 Map，多实例不共享，既有）、B-03（改绑后历史用量归属不变）见 `docs/plan/API_KEY_MEMBER_BINDING_PLAN.md` §6。
