# BILLING_QUOTA_REQ-012 观察页单下拉筛选 + 流水分页

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/billing_quota.md` |
| 所属 plan | `docs/plan/BILLING_QUOTA_TX_FILTER_PAGINATION_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/billing-menu-split` |
| 状态 | `done` |

## 2. 需求描述

### 背景
REQ-011 的筛选用了两个下拉框（范围 + 成员），操作割裂；流水一次性返回最近 100 条、无分页，流水较多时不便于浏览。

### 目标
- 筛选合并为**单个下拉框**：`全员` / `只看团队` / 成员列表（成员分组展示）。
- 流水列表改为**服务端分页**（默认每页 20 条，上一页 / 下一页）。
- 筛选切换时重置分页到第 1 页。

### 验收条件
- [x] 后端 `typecheck` / `test` / `lint` 通过。
- [x] 前端 `typecheck` / `lint` / `build` 通过。
- [x] 单下拉正确过滤余额卡片与流水表。
- [x] 流水分页正确，筛选切换后重置到第 1 页。

## 3. 技术方案摘要
- 前端 `pages/billing.tsx`：单一 `filter` 状态（`all`/`team`/成员 `userId`），单个 `Select`（成员用 `SelectGroup`/`SelectLabel` 分组）；流水查询带 `accountType`/`userId`/`limit`/`offset`，`keepPreviousData`；切换筛选 `setOffset(0)`。
- 前端 `features/billing/api.ts`：`listQuotaTransactions` 返回 `QuotaTransactionPage`，支持 `accountType`/`userId`/`from`/`to`/`limit`/`offset`。
- 后端 `billing.service.ts`：`listTransactions` 改为分页（`skip/limit` + `countDocuments`），返回 `{items,total,limit,offset}`；新增 `accountType`/`userId` 过滤。
- 后端 `dto/list-transactions-query.dto.ts`：新增 `accountType`/`userId`/`limit`/`offset`。
- 结构详见 `docs/plan/BILLING_QUOTA_TX_FILTER_PAGINATION_PLAN.md` §3。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/BILLING_QUOTA_REQ-012_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
