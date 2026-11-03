# PORTAL_UI_REQ-002 CRUD 页面迁移

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
7 个 CRUD 页面的添加/编辑表单平铺在列表上方，删除等危险操作点击即执行。依赖 REQ-001 的原语完成迁移。

### 目标（按 plan §4 映射）
- `providers.tsx`：添加/编辑→抽屉；官方直连→弹窗；删除→AlertDialog。
- `models.tsx`：添加/编辑→抽屉；官方预设导入→抽屉；删除→AlertDialog。
- `api-keys.tsx`：创建/编辑→抽屉；吊销/轮换→AlertDialog；轮换后一次性 key→弹窗。
- `team.tsx`：邀请成员→弹窗；团队限额→弹窗；移除成员→AlertDialog。
- `roles.tsx`：添加/编辑→抽屉；删除→AlertDialog。
- `admin-tenants.tsx`：新建租户→弹窗；停用/启用→AlertDialog。
- `billing.tsx`：充值/调整→弹窗。

### 验收条件
- [ ] 各页面添加/编辑不再以 Card 平铺在列表上方。
- [ ] 所有删除/吊销/轮换/停用均有 AlertDialog 二次确认。
- [ ] 提交按钮 pending 禁用 + 文案反馈；空态/加载态/错误态三态齐全。
- [ ] `pnpm --filter portal-frontend lint` / `typecheck` / `build` 通过，`dev` 目检闭环可用。

## 3. 技术方案摘要
- 复用 REQ-001 的 dialog/sheet/alert-dialog/select/label 原语。
- 表单本地态用组件 `useState`（弹窗开合 + form 值），服务端数据仍走 react-query mutation。
- 迁移保持各页面既有业务逻辑（API 调用、invalidate、ApiError 处理）不变。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/PORTAL_UI_REQ-002_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
