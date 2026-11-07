# REQ-007：前端渠道健康状态列改造

> 关联 Feature：`docs/feature/model_provider.md`、`docs/feature/usage_metering.md`
> 关联 Plan：`docs/plan/PROVIDER_USAGE_HEALTH_PLAN.md`
> 状态：✅ 已完成
> 开发记录：`docs/development/PROVIDER_USAGE_REQ-005_DEVELOPMENT.md`

## 背景

主动查询移除后，渠道页「用量探测」列的数据源变为被动信号产出的健康快照（REQ-006），需改造为「健康状态」列。

## 验收条件

- [x] `ProviderUsageView` 类型调整：移除 quota 字段，新增 `exhaustedUntil` / `cooldownUntil` / `consecutiveFailures`
- [x] 「用量探测」列改造为「健康状态」列：
  - 限流中（`exhaustedUntil > now`）：黄色，显示恢复时间
  - 冷却中（`cooldownUntil > now`）：红色，显示恢复时间 + 连续失败次数
  - 正常：绿色，有速率余量时展示 `速率:N`
  - 无快照：灰色「未探测」
- [x] typecheck / lint / build 通过

## 代码位置

- `apps/portal-frontend/src/pages/providers.tsx`
- `apps/portal-frontend/src/features/providers/types.ts`
