# OFFICIAL_API_REQ-008 开发记录（前端：渠道管理页官方直连卡片区）

> 对应需求：`docs/requirement/OFFICIAL_API_REQ-008_FRONTEND_OFFICIAL_CHANNEL.md`
> 对应计划：`docs/plan/OFFICIAL_CHANNEL_PRESET_PLAN.md`
> 分支：`main`

## 1. 实现摘要

在「渠道管理」页落地「官方直连」卡片区，降低团队接入主流 LLM 官方的门槛。

- 拉 `listOfficialPresets()` 逐家展示官方预置卡片（label / 协议类型 / Base URL / 官方模型数）。
- 按 `Provider.presetKey` 关联已有渠道：无匹配显示「未开启」，有匹配显示「已开启 N 个」并列出渠道名。
- 「开启使用 / 再添加一个」内联展开：填 API Key（可选自定义渠道名称）→ 调 `createProviderFromPreset` → 成功后刷新渠道与模型列表并提示「导入 N 个模型（跳过 M 个已存在）」。

## 2. 代码改动点

### 前端

| 文件 | 说明 |
|---|---|
| `features/models/types.ts` | `OfficialProviderPreset` 增加 `key` |
| `features/providers/types.ts` | `Provider` 增加 `presetKey?`；新增 `CreateProviderFromPresetInput/Result` |
| `features/providers/api.ts` | 新增 `createProviderFromPreset()` |
| `pages/providers.tsx` | 新增「官方直连」卡片区 + 开启弹窗 + 状态联动 |

## 3. 踩坑记录

1. 预置卡片「已开启 N 个」按 `presetKey` 分组统计，同一官方多开（不同名称/key）均计入，卡片保留「再添加一个」入口（不因已开启而禁用）。

## 4. 验证结果

- 前端：lint 3 警告（均 `team.tsx` 既有，与本次改动无关）、typecheck 通过、build 通过。

## 5. 关联

- feature：`docs/feature/model_provider.md`
- 计划：`docs/plan/OFFICIAL_CHANNEL_PRESET_PLAN.md`
