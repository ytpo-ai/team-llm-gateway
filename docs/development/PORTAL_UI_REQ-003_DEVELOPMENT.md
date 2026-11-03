# PORTAL_UI_REQ-003 开发记录（日志页 select 统一与文档清理）

> 对应需求：`docs/requirement/PORTAL_UI_REQ-003_LOG_SELECT_DOCS.md`
> 对应计划：`docs/plan/PORTAL_UI_REFINEMENT_PLAN.md`

## 1. 实现摘要

- `usage-logs.tsx`：状态筛选 `<select>` 替换为 radix `Select` 原语。
- `audit-logs.tsx`：动作 / 资源类型筛选 `<select>` 替换为 radix `Select` 原语。
- `docs/rules/UI.md`：清理改造完成后的「反例」小节与「需改造」现状描述，更新原语清单与状态色语义。

## 2. 代码改动点

| 文件 | 说明 |
|---|---|
| `pages/usage-logs.tsx` | 筛选下拉 Select 化 |
| `pages/audit-logs.tsx` | 动作/资源类型下拉 Select 化 |
| `docs/rules/UI.md` | 移除 §2 反例小节、§4 现状描述，更新 §1 原语清单 |

## 3. 验证结果

- `grep` 确认 `src/` 下无 `selectClass` 及手写 `<select` 残留。
- `pnpm --filter portal-frontend typecheck` / `lint` / `build`：通过。

## 4. 关联

- feature：`docs/feature/portal_ui.md`
- 规范：`docs/rules/UI.md`
