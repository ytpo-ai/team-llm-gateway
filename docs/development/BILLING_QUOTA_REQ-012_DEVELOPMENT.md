# BILLING_QUOTA_REQ-012 开发记录（单下拉筛选 + 流水分页）

> 对应需求：`docs/requirement/BILLING_QUOTA_REQ-012_FILTER_PAGINATION.md`
> 对应计划：`docs/plan/BILLING_QUOTA_TX_FILTER_PAGINATION_PLAN.md`
> 分支：`feat/billing-menu-split`

## 1. 实现摘要

「余额与流水」观察页将 REQ-011 的两个筛选下拉合并为单个下拉（全员 / 只看团队 / 成员列表分组），流水列表改为服务端分页（默认每页 20 条）。

### 前端
- `pages/billing.tsx`：
  - 单一 `filter: 'all' | 'team' | <成员userId>` 状态，替换原 `scope` + `memberId`。
  - 单个 `Select`，成员项用 `SelectGroup` + `SelectLabel` 分组。
  - 流水查询 `queryKey` 含 `[accountType, userId, offset]`，`placeholderData: keepPreviousData`。
  - 切换筛选 `setOffset(0)` 重置分页。
  - 分页控件：上一页 / 下一页 + 页码显示，`hasPrev` / `hasNext` 由 `total` 计算。
- `features/billing/api.ts`：`listQuotaTransactions` 改为返回 `QuotaTransactionPage`，支持 `accountType`/`userId`/`from`/`to`/`limit`/`offset`（默认 limit 20 / offset 0）。
- `features/billing/types.ts`：新增 `QuotaTransactionPage` 类型。

### 后端
- `billing.service.ts`：`listTransactions` 改为分页（`skip`/`limit` + `countDocuments`），返回 `{items,total,limit,offset}`；新增 `accountType`/`userId` 过滤；`TRANSACTION_LIMIT` 常量替换为 `DEFAULT_TRANSACTION_LIMIT = 20`。
- `dto/list-transactions-query.dto.ts`：新增 `accountType`/`userId`/`limit`（`@Min(1) @Max(200)`）/`offset`（`@Min(0)`）。
- `billing.service.spec.ts`：`listTransactions` 测试更新为分页返回形状，新增 `accountType`/`userId` 过滤用例；`mockTransactionFind` 增加 `skip`/`countDocuments` mock。

## 2. 代码改动点

| 文件 | 说明 |
|---|---|
| `apps/portal-frontend/src/pages/billing.tsx` | 单下拉筛选 + 服务端分页 |
| `apps/portal-frontend/src/features/billing/api.ts` | `listQuotaTransactions` 返回分页 + 新增查询参数 |
| `apps/portal-frontend/src/features/billing/types.ts` | 新增 `QuotaTransactionPage` |
| `apps/portal-backend/src/modules/billing/billing.service.ts` | 流水分页 + `accountType`/`userId` 过滤 |
| `apps/portal-backend/src/modules/billing/dto/list-transactions-query.dto.ts` | 新增 `accountType`/`userId`/`limit`/`offset` |
| `apps/portal-backend/src/modules/billing/billing.service.spec.ts` | 更新流水分页测试 + 新增过滤用例 |

## 3. 踩坑记录

1. **服务端分页 vs 客户端过滤**：余额卡片仍为客户端过滤（账户数量有限、已全量加载），仅流水走服务端分页；`accountType`/`userId` 由前端 `filter` 映射为查询参数，避免前端再对分页结果做二次过滤导致页面对不上 `total`。
2. **`keepPreviousData` 平滑分页**：分页/筛选切换时保留旧数据，避免每次翻页整表闪烁；`queryKey` 必须包含分页与过滤参数以触发重新请求。
3. **筛选切换重置分页**：`onValueChange` 中同时 `setFilter` 与 `setOffset(0)`，否则停留在旧页码会显示空白页。

## 4. 验证结果

- 后端 `pnpm --filter portal-backend typecheck`：通过。
- 后端 `pnpm --filter portal-backend test`：通过（196 passed，新增 `accountType`/`userId` 用例）。
- 后端 `pnpm --filter portal-backend lint`：通过。
- 前端 `pnpm --filter portal-frontend typecheck` / `lint` / `build`：通过（仅 2 条既有 warning）。

## 5. 关联

- feature：`docs/feature/billing_quota.md`
- 上游：`docs/plan/BILLING_QUOTA_TX_FILTER_PAGINATION_PLAN.md` §3
