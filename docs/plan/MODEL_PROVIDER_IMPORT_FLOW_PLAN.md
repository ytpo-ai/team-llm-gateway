# 渠道模型导入流程优化开发计划（MODEL_PROVIDER_IMPORT_FLOW）

> 本 plan 优化渠道创建后的模型导入流程：从自动全部导入改为引导式批量测试并通过后导入。
>
> - 上游 plan：`docs/plan/OFFICIAL_CHANNEL_PRESET_PLAN.md`
> - 定稿时间：2026-11-08
> - 状态：已完成

---

## 1. 需求背景

当前创建渠道（尤其是从预置一键开启）后自动导入该预置下所有模型，但部分模型可能在上游不可用（如未开通、已下线），导致导入的模型实际无法使用。管理员需要手动逐个排查。

现优化为：创建渠道后不自动导入模型，而是弹出"下一步"对话框，列出预置模型列表供勾选/全选，管理员可批量测试连通性，只有测试成功的模型才导入。

同时渠道列表的「测试」按钮改为「导入模型」，复用相同的批量测试+导入交互；模型管理页隐藏「官方预设导入」按钮（该功能已整合到渠道页）。

## 2. 目标

1. 创建渠道（预置一键开启 / 自定义）后不自动导入模型
2. 预置渠道创建成功后弹窗列出模型，支持勾选/全选
3. 管理员点击「测试并导入」，批量探测连通性，仅测试通过的模型导入
4. 渠道列表「测试」按钮改为「导入模型」，交互与创建渠道后的弹窗一致
5. 模型管理页隐藏「官方预设导入」按钮

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 后端 `createFromPreset` | 移除 `modelsService.bulkCreate()` 调用，仅返回 `ProviderView` |
| 后端 controller | 适配新返回值，审计日志不再包含导入模型数 |
| 前端预置开启 | `enableMutation.onSuccess` 关闭预置弹窗后打开导入模型抽屉（复用现有 test drawer） |
| 前端渠道列表 | 「测试」按钮文案改为「导入模型」 |
| 前端模型页 | 移除「官方预设导入」按钮 |
| 前端类型 | `CreateProviderFromPresetResult` 改为直接返回 `Provider` |

## 4. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [MODEL_PROVIDER_IMPORT_FLOW_REQ-001](../requirement/MODEL_PROVIDER_IMPORT_FLOW_REQ-001_IMPORT_FLOW.md) | 后端移除自动导入 + 前端导入流程优化 | 创建预置渠道后不自动导入模型；弹窗可勾选/全选模型并批量测试；仅通过模型导入；渠道列表测试→导入模型；模型页隐藏预设导入按钮；lint/typecheck/build 通过 |

## 5. 里程碑

1. [✅] REQ-001 后端移除自动导入 + 前端导入流程优化 + 模型页按钮隐藏

## 6. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| P-01 | 自定义渠道（无预置 key）创建后不弹窗，因无预设模型列表 | ✅ 已确认 |
| P-02 | 现有测试抽屉已包含全选/批量测试/导入通过模型功能，直接复用 | ✅ 无需新增前端组件 |
| P-03 | `CreateProviderFromPresetResult` 返回值结构变更，仅前端 `providers.tsx` 使用 | ✅ 无其他调用方 |

## 7. 关联

- 上游：`OFFICIAL_CHANNEL_PRESET_PLAN.md`、`PROVIDER_TEST_DIALOG_PLAN.md`
- feature：`docs/feature/model_provider.md`
- requirement：见 §4