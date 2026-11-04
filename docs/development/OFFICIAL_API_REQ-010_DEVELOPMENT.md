# OFFICIAL_API_REQ-010 开发记录（前端：统一添加入口 + 官方双格式开启 + 编辑对齐）

> 对应需求：`docs/requirement/OFFICIAL_API_REQ-010_FRONTEND_UNIFIED_ADD.md`
> 对应计划：`docs/plan/OFFICIAL_CHANNEL_DUAL_FORMAT_PLAN.md`
> 分支：`feat/official-channel-dual-format`

## 1. 实现摘要

把「官方直连卡片区 + 添加上游渠道」两个入口合并为统一的「添加渠道」弹窗，并让官方渠道开启支持选格式、改 URL；编辑对齐普通渠道（含「是否官方渠道」）。

- 渠道管理页只保留**一个「添加渠道」按钮**；弹窗内第一项「自定义渠道」卡片，后续「官方渠道」列表（两列布局，`sm:grid-cols-2`，弹窗加宽 `sm:max-w-2xl`）。
- 创建自定义渠道由右侧抽屉（Sheet）改为**弹窗（Dialog）**，与官方渠道开启统一；**编辑渠道保持右侧抽屉（Sheet）**。表单字段抽 `formBody` 复用，创建/编辑共用。
- 官方渠道开启弹窗：接入格式选择（来自 `formats`）+ Base URL 可编辑（按所选格式预填）+ API Key + 名称。
- 渠道编辑表单新增「是否官方渠道」（`presetKey` 下拉，可设「无（普通渠道）」）。
- 模型页「官方预设导入」选择器由「按 `type`」改为「按 `key`/label」。

## 2. 代码改动点

### 前端

| 文件 | 说明 |
|---|---|
| `features/models/types.ts` | `OfficialProviderPreset` 增 `formats`（新增 `OfficialFormatPreset`） |
| `features/providers/types.ts` | `ProviderPatch` 增 `presetKey`；`CreateProviderFromPresetInput` 增 `format`/`baseUrl` |
| `pages/providers.tsx` | 统一「添加渠道」入口；官方列表两列；开启弹窗（格式+URL）；创建改 Dialog、编辑保持 Sheet；编辑表单增 `presetKey` |
| `pages/models.tsx` | 官方预设导入选择器按 `key`；文案去协议类型措辞 |

## 3. 踩坑记录

1. Radix `SelectItem` 不允许空字符串 `value`：「是否官方渠道」的「无（普通渠道）」用哨兵值 `__none__` 映射空串，避免运行时报错。
2. 创建（Dialog）与编辑（Sheet）表单字段一致，抽 `formBody` 复用；Dialog 内表单用 `grid max-h-[75vh] overflow-y-auto` 处理长表单滚动，Sheet 沿用 `flex flex-1 flex-col overflow-y-auto`。
3. 编辑提交始终带 `presetKey`（空串表示清空），后端 `update` 已支持 `dto.presetKey || undefined` 归一，实现「取消官方标记」。

## 4. 验证结果

- 前端：typecheck 通过、lint 仅既有警告（`button.tsx`/`theme-provider.tsx` 的 `only-export-components`，与本次无关）、build 通过。

## 5. 关联

- feature：`docs/feature/model_provider.md`
- 计划：`docs/plan/OFFICIAL_CHANNEL_DUAL_FORMAT_PLAN.md`
