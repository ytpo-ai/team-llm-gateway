# REQ-001：渠道用量数据模型 + 上游查询机制

> 关联 Plan：`docs/plan/PROVIDER_USAGE_SENSE_PLAN.md`
> 状态：✅ 已完成
> 开发记录：`docs/development/PROVIDER_USAGE_REQ-001_DEVELOPMENT.md`

## 验收条件

- [x] Provider Schema 新增 `usageEndpoint` 可选字段
- [x] 新增 ProviderUsage Mongoose Schema（上游用量快照缓存）
- [x] ProviderUsageService：fetchAndCache / getSnapshot / isExhausted / markExhausted / updateFromHeaders
- [x] UpstreamAdapter 接口扩展 `fetchUsage()` 可选方法 + `ProviderUsageSnapshot` 类型
- [x] lint / typecheck / test 通过

## 代码位置

- `apps/portal-backend/src/modules/usage/schemas/provider-usage.schema.ts`
- `apps/portal-backend/src/modules/usage/provider-usage.service.ts`
- `apps/portal-backend/src/modules/providers/schemas/provider.schema.ts`
- `apps/portal-backend/src/modules/proxy/adapters/upstream-adapter.ts`