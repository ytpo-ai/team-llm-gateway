# PORTAL_UI_REQ-001 UI 基础原语

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
Portal 前端 `components/ui/` 仅有 `button/card/input`，缺少弹窗、抽屉、二次确认、下拉、标签等原语，导致页面手写平铺表单与重复样式。本 REQ 补齐基础原语，为后续页面迁移铺路。

### 目标
- 安装 radix 依赖：`@radix-ui/react-dialog`、`@radix-ui/react-alert-dialog`、`@radix-ui/react-select`、`@radix-ui/react-label`。
- 新增 `components/ui/` 原语：`dialog.tsx`、`sheet.tsx`、`alert-dialog.tsx`、`select.tsx`、`label.tsx`（shadcn new-york 风格）。
- `index.css` 补 `--destructive` / `--color-destructive` token（浅色 + 深色）。

### 验收条件
- [ ] `pnpm --filter portal-frontend lint` / `typecheck` / `build` 通过。
- [ ] `ui/` 下 5 个原语可用，组件风格与既有 `button/card/input` 一致。
- [ ] `text-destructive` 在 dark/light 下均正确渲染。

## 3. 技术方案摘要
- 依赖：4 个 `@radix-ui/*` 包（dialog、alert-dialog、select、label）。
- 组件：手动按 shadcn new-york 源码落地（项目无 shadcn CLI，`components.json` 已就绪）。
- 样式：复用 `cn()`（`clsx` + `tailwind-merge`）与 Tailwind v4 token。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/PORTAL_UI_REQ-001_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
