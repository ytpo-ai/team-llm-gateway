# PORTAL_UI_REQ-002 开发记录（CRUD 页面迁移）

> 对应需求：`docs/requirement/PORTAL_UI_REQ-002_CRUD_PAGE_MIGRATION.md`
> 对应计划：`docs/plan/PORTAL_UI_REFINEMENT_PLAN.md`

## 1. 实现摘要

将 7 个 CRUD 页面的「平铺表单」迁移为「列表为主体 + 弹窗/抽屉承载低频操作」，危险操作统一加二次确认：

| 页面 | 迁移结果 |
|---|---|
| `providers.tsx` | 添加/编辑渠道→抽屉；官方直连→弹窗；删除→AlertDialog |
| `models.tsx` | 添加/编辑模型→抽屉；官方预设导入→抽屉；删除→AlertDialog |
| `api-keys.tsx` | 创建/编辑 Key→抽屉；吊销/轮换→AlertDialog；轮换后一次性 key→弹窗 |
| `team.tsx` | 邀请成员→弹窗；团队限额→弹窗；移除成员→AlertDialog |
| `roles.tsx` | 添加/编辑角色→抽屉；删除→AlertDialog |
| `admin-tenants.tsx` | 新建租户→弹窗；停用/启用→AlertDialog |
| `billing.tsx` | 充值/调整额度→弹窗 |

- 各页面上右角新增主操作按钮（`添加` / `创建` / `新建` / `充值`），替代平铺表单区。
- 原生 `<select>` 全部替换为 radix `Select` 原语（含 team 成员角色/使用角色、providers 协议类型/认证方式、models 归属渠道、billing 类型/目标）。

## 2. 代码改动点

| 文件 | 说明 |
|---|---|
| `pages/providers.tsx` | 渠道表单抽屉化 + 官方直连弹窗 + 删除确认 |
| `pages/models.tsx` | 模型表单抽屉化 + 官方预设导入抽屉化 + 删除确认 |
| `pages/api-keys.tsx` | Key 表单抽屉化 + 一次性 key 弹窗 + 吊销/轮换确认 |
| `pages/team.tsx` | 邀请/限额弹窗化 + 移除确认 + 角色下拉 Select 化 |
| `pages/roles.tsx` | 角色表单抽屉化 + 删除确认 |
| `pages/admin-tenants.tsx` | 新建租户弹窗化 + 停用/启用确认 |
| `pages/billing.tsx` | 充值/调整弹窗化 + 下拉 Select 化 |

## 3. 踩坑记录

1. **AlertDialog 受控模式**：危险操作用 `open={target !== null}` + `onOpenChange` 受控，配合记录待操作目标的 state（`removeTarget`/`action`/`statusTarget`），确认后先 `mutate` 再 `setTarget(null)`，避免误触发。
2. **抽屉表单滚动**：`SheetContent` 为 flex-col，表单用 `flex flex-1 flex-col gap-4 overflow-y-auto` 才能让长表单（如 api-keys 7 字段）在抽屉内滚动，`SheetFooter` 固定底部。
3. **Select 空值项**：筛选/未分配等「空字符串 = 全部/默认」场景，保留 `<SelectItem value="">` 让空值有明确展示项，而非依赖 placeholder。
4. **`text-destructive` 生效**：REQ-001 补全 token 后，原 `text-destructive` 用法（billing/status）得以正确渲染，删除确认按钮统一用 `bg-destructive text-destructive-foreground`。

## 4. 验证结果

- `pnpm --filter portal-frontend typecheck`：通过。
- `pnpm --filter portal-frontend lint`：0 errors（4 条 warning 中 3 条为预存，1 条为 `buttonVariants` fast-refresh 提示）。
- `pnpm --filter portal-frontend build`：通过（2122 modules）。

## 5. 关联

- feature：`docs/feature/portal_ui.md`
- 规范：`docs/rules/UI.md`
