# USAGE_METERING_REQ-003 开发记录（前端用量看板）

> 对应需求：`docs/requirement/USAGE_METERING_REQ-003_FRONTEND_DASHBOARD.md`
> 对应计划：`docs/plan/USAGE_METERING_PLAN.md`
> 分支：`main`

## 1. 实现摘要

落地「计量与用量」前端：改造 `dashboard` 占位页为用量看板，接入 `/usage/*` 查询 API，展示总览卡片 + 趋势图 + 按模型/成员/Key 拆分。

- `features/usage/types.ts`：`UsageSummary`/`UsageTrendPoint`/`UsageBreakdownItem`/`UsageQuery`/`UsageGranularity`。
- `features/usage/api.ts`：`getUsageSummary`/`getUsageTrends`/`getUsageByModel`/`getUsageByMember`/`getUsageByKey`，`toQuery` 序列化时间区间/粒度。
- `pages/dashboard.tsx`：
  - 时间范围（近 7/30/90 天）+ 粒度（按天/按小时）切换。
  - 总览卡片：请求数 / 总 Token / 输入输出 Token / 总成本。
  - `TrendChart`：SVG 自绘柱状图（`<title>` 原生悬浮提示），不引图表库。
  - `BreakdownTable`：按模型/成员/Key 三张拆分表（label + 请求数 + Token + 成本）。
- 路由沿用 `/`（index），导航文案维持「概览」。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `features/usage/types.ts` | 用量类型定义 |
| `features/usage/api.ts` | usage 查询接口封装 |

### 修改

| 文件 | 说明 |
|---|---|
| `pages/dashboard.tsx` | 占位页 → 用量看板 |

## 3. 踩坑记录

1. **零新增依赖自绘图表**：趋势图用原生 `<svg><rect>` + `<title>` 实现柱状图与悬浮提示，避免引入 chart 库（计划 U-05）；空数据/加载态分别渲染引导文案。
2. **RBAC 交给后端**：前端不按角色隐藏数据维度，`member` 仅本人数据由后端 `$match` 保证，前端统一渲染（需求验收「前端不做角色假设渲染」）。
3. **查询 key 用范围对象**：以 `{ from, to, granularity }` 作为 `queryKey`，切换范围/粒度自动触发 `useQuery` 重取，避免手动 refetch。

## 4. 验证结果

- `pnpm --filter portal-frontend typecheck`：通过。
- `pnpm --filter portal-frontend lint`：0 errors（1 个既有 warning 与本次无关，位于 `theme-provider.tsx`）。
- `pnpm --filter portal-frontend build`：通过。

## 5. 关联

- feature：`docs/feature/usage_metering.md`
- 数据契约：`docs/technical/db_schema/USAGE_METERING_SCHEMA.MD` §5
