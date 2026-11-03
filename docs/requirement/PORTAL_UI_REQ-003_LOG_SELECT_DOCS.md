# PORTAL_UI_REQ-003 日志页 select 统一与文档清理

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/portal_ui.md` |
| 所属 plan | `docs/plan/PORTAL_UI_REFINEMENT_PLAN.md` |
| 需求管理 ID | — |
| 分支 | — |
| 状态 | `done` |

## 2. 需求描述

### 背景
`usage-logs.tsx`、`audit-logs.tsx` 的筛选下拉仍为手写 `<select>` 内联 className；`docs/rules/UI.md` 的反例小节在改造完成后应清理。

### 目标
- `usage-logs.tsx`、`audit-logs.tsx` 的筛选 `<select>` 替换为 radix `Select` 原语。
- 清理 `docs/rules/UI.md` §2 反例小节与相关引用（改造完成后不再违规）。
- 确认全仓无手写 `selectClass` 或内联 `rounded-md border border-input ...` 的 `<select>` 残留。

### 验收条件
- [ ] `grep` 确认无 `selectClass` 及手写 `<select className=...>` 残留（除原语内部）。
- [ ] `pnpm --filter portal-frontend lint` / `typecheck` / `build` 通过。

## 3. 技术方案摘要
- 复用 REQ-001 的 `Select` 原语替换原生下拉。
- `docs/rules/UI.md` 反例小节改为「已整改」说明或移除。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/PORTAL_UI_REQ-003_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
