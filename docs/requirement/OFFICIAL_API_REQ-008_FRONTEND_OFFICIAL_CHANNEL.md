# OFFICIAL_API_REQ-008 前端：渠道管理页官方直连卡片区 + 一键开启

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/model_provider.md` |
| 所属 plan | `docs/plan/OFFICIAL_CHANNEL_PRESET_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/official-channel-preset` |
| 状态 | `in-progress` |

## 2. 需求描述

### 背景
渠道管理页仅有手动表单，无「官方直连」快捷入口。现落地官方直连卡片区，降低团队接入主流 LLM 官方的门槛。

### 目标
- 渠道管理页新增「官方直连」卡片区：拉 `listOfficialPresets()` 逐家展示卡片（label / baseUrl / 协议类型 / 模型数）。
- 卡片按 `presetKey` 关联已有渠道，显示「未开启」（无渠道）或「已开启 N 个」（列出渠道名），并提供「开启使用 / 再添加一个」按钮。
- 开启弹窗：输入 API Key（可选自定义名称）→ 调 `createProviderFromPreset` → 成功后刷新渠道列表并提示「新增渠道 + 导入模型数」。

### 验收条件
- [ ] 卡片区正确展示所有官方预置，默认「未开启」。
- [ ] 已开启的官方（存在 `presetKey` 匹配渠道）显示「已开启 N 个」并列出渠道名。
- [ ] 开启弹窗填 Key 后一键建渠道并自动导入模型，提示导入结果。
- [ ] 仅 `team_admin` 可见可操作。
- [ ] 前端 `lint`/`typecheck`/`build` 通过。

## 3. 技术方案摘要
- 复用 `features/providers` 与 `features/models` 现有 query/API；`OfficialProviderPreset` 类型补 `key`；`Provider` 类型补 `presetKey?`；新增 `createProviderFromPreset`。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/OFFICIAL_API_REQ-008_DEVELOPMENT.md`（待补充） |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [ ] 待验收
- [ ] 已交付
