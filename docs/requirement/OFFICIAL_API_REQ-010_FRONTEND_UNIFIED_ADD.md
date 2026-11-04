# OFFICIAL_API_REQ-010 前端：统一添加入口 + 官方双格式开启 + 编辑对齐

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/model_provider.md` |
| 所属 plan | `docs/plan/OFFICIAL_CHANNEL_DUAL_FORMAT_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/official-channel-dual-format` |
| 状态 | `in-review` |

## 2. 需求描述

### 背景
渠道管理页「官方直连」与「添加上游渠道」两个入口割裂；官方渠道开启时无法选格式、无法改 URL；编辑表单缺「是否官方渠道」字段；模型页官方预设导入按 `type` 选择预置（预置已改为多格式，不再适用）。

### 目标
- 渠道管理页只保留**一个「添加渠道」按钮**；点击打开弹层：第一项「自定义渠道」卡片，后续「官方渠道」列表。
- 移除页面独立的「官方直连」卡片区。
- 官方渠道开启弹窗：格式选择（来自 `formats`）+ **URL 可编辑**（按所选格式预填）+ API Key + 名称。
- 渠道编辑表单新增「是否官方渠道」（`presetKey` 下拉，可设空 = 普通渠道）。
- `models.tsx` 官方预设导入的选择器由「按 `type`」改为「按 `key`/label」。

### 验收条件
- [ ] 渠道管理页仅一个「添加渠道」按钮，弹层含「自定义渠道」+「官方渠道」列表。
- [ ] 官方渠道开启时可选择格式、可修改 URL，提交调 `createProviderFromPreset({ presetKey, apiKey, name?, format, baseUrl })`。
- [ ] 编辑表单可改「是否官方渠道」，保存后渠道列表按 `presetKey` 归属更新。
- [ ] 模型页官方预设导入按 `key` 选择预置，可正常导入模型。
- [ ] 前端 `lint` / `typecheck` / `build` 通过。

## 3. 技术方案摘要

- 复用 `features/providers` / `features/models` 现有 API；`OfficialProviderPreset` 类型补 `formats`；`ProviderPatch` 补 `presetKey`；`CreateProviderFromPresetInput` 补 `format`/`baseUrl`。
- 交互重构集中在 `pages/providers.tsx`，`pages/models.tsx` 仅改选择器键值。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/OFFICIAL_API_REQ-010_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [ ] 待验收
- [ ] 已交付
