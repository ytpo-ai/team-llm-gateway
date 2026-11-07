# REQ-005：移除渠道主动查询链路

> 关联 Feature：`docs/feature/model_provider.md`、`docs/feature/usage_metering.md`
> 关联 Plan：`docs/plan/PROVIDER_USAGE_HEALTH_PLAN.md`
> 状态：✅ 已完成
> 开发记录：`docs/development/PROVIDER_USAGE_REQ-005_DEVELOPMENT.md`

## 背景

上游用量主动查询（`UpstreamAdapter.fetchUsage()` 无任何实现 + 通用 `usageEndpoint` 字段猜测）在多数 LLM 平台不可用，属鸡肋链路，整体移除。被动信号（429 / 响应头 / 熔断）由 REQ-006 承接。

## 验收条件

- [x] `ProviderUsageService` 删除 `fetchAndCache()` / `genericFetchUsage()` / `pickNumber()` / `pickString()` / `upsert()` / `markError()`
- [x] 删除 `POST /providers/:id/fetch-usage` 端点
- [x] Provider schema / create DTO / update DTO / providers.service 移除 `usageEndpoint` 字段
- [x] `UpstreamAdapter` 移除 `fetchUsage()` 可选方法与 `ProviderUsageSnapshot` 类型
- [x] ProviderUsage schema 移除 `quotaTotal` / `quotaUsed` / `quotaUnit`
- [x] 前端移除用量查询端点表单项、🔍 探测按钮、`fetchProviderUsage` API 及相关类型
- [x] lint / typecheck / test 通过

## 代码位置

- 后端：`apps/portal-backend/src/modules/usage/provider-usage.service.ts`、`modules/providers/`（schema/dto/service/controller）、`modules/proxy/adapters/upstream-adapter.ts`
- 前端：`apps/portal-frontend/src/pages/providers.tsx`、`features/providers/{api,types}.ts`
