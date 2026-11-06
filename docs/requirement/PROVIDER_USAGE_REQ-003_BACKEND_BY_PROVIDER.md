# REQ-003：用量 API 新增按渠道拆分（by-provider）

> 关联 Plan：`docs/plan/PROVIDER_USAGE_SENSE_PLAN.md`
> 状态：✅ 已完成
> 开发记录：`docs/development/PROVIDER_USAGE_REQ-001_DEVELOPMENT.md`

## 验收条件

- [x] `UsageService.byProvider()` 按 `providerId` 聚合 UsageLog
- [x] 关联 Provider.name 补全 label 展示
- [x] `UsageController` 新增 `GET /usage/by-provider` 端点
- [x] `breakdown()` 方法签名支持 `$providerId`
- [x] lint / typecheck / test 通过

## 代码位置

- `apps/portal-backend/src/modules/usage/usage.service.ts`
- `apps/portal-backend/src/modules/usage/usage.controller.ts`