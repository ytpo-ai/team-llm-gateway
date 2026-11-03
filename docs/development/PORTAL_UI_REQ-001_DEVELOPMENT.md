# PORTAL_UI_REQ-001 开发记录（UI 基础原语）

> 对应需求：`docs/requirement/PORTAL_UI_REQ-001_UI_PRIMITIVES.md`
> 对应计划：`docs/plan/PORTAL_UI_REFINEMENT_PLAN.md`

## 1. 实现摘要

补齐 shadcn new-york 风格 UI 基础原语，为后续 CRUD 页面迁移铺路：

- 新增依赖：`@radix-ui/react-dialog`、`@radix-ui/react-alert-dialog`、`@radix-ui/react-select`、`@radix-ui/react-label`。
- 新增原语：`ui/dialog.tsx`（弹窗）、`ui/sheet.tsx`（抽屉，基于 dialog）、`ui/alert-dialog.tsx`（二次确认）、`ui/select.tsx`（下拉）、`ui/label.tsx`。
- `ui/button.tsx`：新增 `destructive` variant，并导出 `buttonVariants`（供 alert-dialog action/cancel 复用）。
- `index.css`：补全 design token（`popover`/`secondary`/`accent`/`destructive` 及其 foreground），补齐 `@theme inline` 的 `--color-*` 映射。

## 2. 代码改动点

| 文件 | 说明 |
|---|---|
| `components/ui/dialog.tsx` | Dialog 原语（含 overlay/content/header/footer/title/description） |
| `components/ui/sheet.tsx` | Sheet 抽屉原语（支持 top/right/bottom/left，默认 right） |
| `components/ui/alert-dialog.tsx` | AlertDialog 二次确认原语 |
| `components/ui/select.tsx` | radix Select 弹层下拉原语 |
| `components/ui/label.tsx` | Label 原语 |
| `components/ui/button.tsx` | 新增 `destructive` variant + 导出 `buttonVariants` |
| `index.css` | 补全 `--destructive`/`--popover`/`--accent`/`--secondary` 等 token |
| `package.json` | 新增 4 个 `@radix-ui/*` 依赖 |

## 3. 踩坑记录

1. **`text-destructive` 原先是失效的**：`billing.tsx`/`settings.tsx`/`admin-tenants.tsx` 早已用了 `text-destructive`，但 `index.css` 从未定义该 token，Tailwind v4 不生成对应 class，颜色一直没渲染。本次补全 token 后一并修复。
2. **buttonVariants 需导出**：alert-dialog 的 action/cancel 复用按钮样式，需从 `button.tsx` 导出 `buttonVariants`（触发一条 fast-refresh 的 lint warning，属 shadcn 标准做法，无害）。

## 4. 验证结果

- `pnpm --filter portal-frontend typecheck`：通过。
- `pnpm --filter portal-frontend build`：通过。

## 5. 关联

- feature：`docs/feature/portal_ui.md`
- 规范：`docs/rules/UI.md`
