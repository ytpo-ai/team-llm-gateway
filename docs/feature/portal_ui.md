# 前端 UI 工程规范（portal_ui）

## 1. 功能设计

### 目标
- 统一 Portal 前端的界面交互与视觉规范，落地 `docs/rules/UI.md` 的约束。
- 建立可复用的 UI 基础原语（dialog / sheet / alert-dialog / select / label），消除手写重复样式。
- 将现有「列表 + 平铺表单」的 CRUD 页面改造为「列表为主体 + 弹窗/抽屉承载低频操作」的交互。

### 数据结构
- 无后端数据模型变更，纯前端工程改造。

### 核心逻辑
- 弹窗（Dialog）vs 抽屉（Sheet）选择标准见 `docs/rules/UI.md` §3（先看是否打断主流程，再看内容复杂度）。
- 删除等危险操作统一经 AlertDialog 二次确认。
- 服务端数据统一走 react-query，zustand 仅客户端/auth 状态。

## 2. 需求追溯

| Plan | Requirement | Development | Fix |
|------|------------|-------------|-----|
| [PORTAL_UI_REFINEMENT](../plan/PORTAL_UI_REFINEMENT_PLAN.md) | [REQ-001 UI 基础原语](../requirement/PORTAL_UI_REQ-001_UI_PRIMITIVES.md) | [开发记录](../development/PORTAL_UI_REQ-001_DEVELOPMENT.md) | — |
| 同上 | [REQ-002 CRUD 页面迁移](../requirement/PORTAL_UI_REQ-002_CRUD_PAGE_MIGRATION.md) | [开发记录](../development/PORTAL_UI_REQ-002_DEVELOPMENT.md) | — |
| 同上 | [REQ-003 日志页 select 统一与文档清理](../requirement/PORTAL_UI_REQ-003_LOG_SELECT_DOCS.md) | [开发记录](../development/PORTAL_UI_REQ-003_DEVELOPMENT.md) | — |
| [SYSTEM_ADMIN_ACCOUNT_MENU](../plan/SYSTEM_ADMIN_ACCOUNT_MENU_PLAN.md) | [REQ-003 账号与菜单优化（用户菜单/分组改名）](../requirement/SYSTEM_ADMIN_REQ-003_ACCOUNT_MENU.md) | [开发记录](../development/SYSTEM_ADMIN_REQ-003_DEVELOPMENT.md) | — |
| [TEAM_CONTEXT_SWITCH](../plan/TEAM_CONTEXT_SWITCH_PLAN.md) | [REQ-004 团队选择器与上下文切换（导航栏选择器）](../requirement/TEAM_MEMBER_REQ-004_TEAM_SELECTOR.md) | [开发记录](../development/TEAM_MEMBER_REQ-004_DEVELOPMENT.md) | — |

## 3. 相关文档
- 规范：`docs/rules/UI.md`
- 规划文档：`docs/plan/PORTAL_UI_REFINEMENT_PLAN.md`

## 4. 相关代码文件
- 前端：`apps/portal-frontend/src/components/ui/`（原语）、`apps/portal-frontend/src/pages/`（CRUD 页面）、`apps/portal-frontend/src/index.css`（design token）
