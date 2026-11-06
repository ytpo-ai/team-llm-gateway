# REQ-004：前端渠道用量展示

> 关联 Plan：`docs/plan/PROVIDER_USAGE_SENSE_PLAN.md`
> 状态：✅ 已完成
> 开发记录：`docs/development/PROVIDER_USAGE_REQ-001_DEVELOPMENT.md`

## 验收条件

- [x] Provider 类型增加 `usageEndpoint` 字段
- [x] ProviderInput / ProviderPatch 支持 `usageEndpoint`
- [x] 渠道管理页列表增加"用量探测"列（显示是否配置了上游用量查询端点）
- [x] Usage API 新增 `getUsageByProvider()`
- [x] 用量看板增加"按渠道"拆分卡片（2×2 网格：按模型 + 按渠道 + 按成员 + 按Key）
- [x] build 通过

## 代码位置

- `apps/portal-frontend/src/features/providers/types.ts`
- `apps/portal-frontend/src/features/usage/api.ts`
- `apps/portal-frontend/src/pages/dashboard.tsx`
- `apps/portal-frontend/src/pages/providers.tsx`