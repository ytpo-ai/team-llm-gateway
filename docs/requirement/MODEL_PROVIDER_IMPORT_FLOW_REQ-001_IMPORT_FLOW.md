# MODEL_PROVIDER_IMPORT_FLOW_REQ-001 渠道模型导入流程优化

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/model_provider.md` |
| 所属 plan | `docs/plan/MODEL_PROVIDER_IMPORT_FLOW_PLAN.md` |
| 需求管理 ID | — |
| 分支 | — |
| 状态 | `done` |

## 2. 需求描述

### 背景
当前创建渠道后自动导入所有预置模型，但部分模型在上游不可用。需要改为引导式批量测试+导入流程，仅导入连通性验证通过的模型。

### 目标
- 创建渠道后不自动导入模型
- 预置渠道创建成功后弹出模型列表，支持勾选/全选
- 批量测试连通性，仅测试通过的模型导入
- 渠道列表「测试」按钮改为「导入模型」
- 模型管理页隐藏「官方预设导入」按钮

### 验收条件
- [ ] 后端 `POST /providers/from-preset` 不再自动导入模型，仅创建渠道
- [ ] 预置渠道创建成功后自动弹出导入模型抽屉（含模型列表/全选/测试/导入）
- [ ] 批量测试后仅通过的模型可导入
- [ ] 渠道列表操作列「测试」按钮文案改为「导入模型」
- [ ] 模型管理页不再显示「官方预设导入」按钮
- [ ] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过
- [ ] 前端 `lint` / `typecheck` / `build` 通过

## 3. 技术方案摘要
- 后端 `ProvidersService.createFromPreset()` 移除 `ModelsService.bulkCreate()` 调用，返回 `ProviderView`
- 前端复用现有测试抽屉（Sheet），已支持模型选择/全选/批量测试/导入通过模型
- 前端 `enableMutation.onSuccess` 关闭预置弹窗后调用 `openTestDrawer` 打开导入抽屉
- 前端类型 `CreateProviderFromPresetResult` 改为 `Provider`

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| plan | `docs/plan/MODEL_PROVIDER_IMPORT_FLOW_PLAN.md` |
| development | `docs/development/MODEL_PROVIDER_IMPORT_FLOW_REQ-001_DEVELOPMENT.md` |