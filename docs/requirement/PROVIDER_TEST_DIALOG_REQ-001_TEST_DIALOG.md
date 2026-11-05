# PROVIDER_TEST_DIALOG_REQ-001 渠道测试弹窗交互优化

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/model_provider.md` |
| 所属 plan | `docs/plan/PROVIDER_TEST_DIALOG_PLAN.md` |
| 需求管理 ID | — |
| 分支 | — |
| 状态 | `done` |

## 2. 需求描述

### 背景
当前渠道测试按钮为内联一键触发，用户无法选择模型或自定义测试消息。现升级为弹窗交互，提升测试灵活性和用户体验。

### 目标
- 后端 `POST /providers/:id/test` 支持接收可选 `modelId` 和 `message` 参数
- 前端点击「测试」按钮弹出 Dialog
- Dialog 内含模型下拉菜单（展示该渠道下的模型）
- 下拉菜单右侧有「拉取模型」按钮
- 消息输入框默认值 `"请问你是哪个模型？"`，可修改
- 测试结果在弹窗内展示

### 验收条件
- [ ] 后端 test 接口支持可选 `modelId` 和 `message`，不传时行为与原来一致
- [ ] 前端点击测试按钮弹出 Dialog
- [ ] 模型下拉菜单显示该渠道下的模型（优先 active）
- [ ] 「拉取模型」按钮可刷新模型列表
- [ ] 消息输入框默认值为「请问你是哪个模型？」，可编辑
- [ ] 执行测试后结果展示在弹窗内（连通/失败 + 延迟 + 消息）
- [ ] 未选模型时仍可测试（后端自动探测）
- [ ] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过
- [ ] 前端 `lint` / `typecheck` / `build` 通过

## 3. 技术方案摘要
- 后端新增 `TestProviderDto`（`modelId?: string`、`message?: string`），service 层优先使用传入参数
- 前端复用现有 `Dialog`、`Select`、`Input`、`Button` 组件
- 模型列表通过 `listModels()` 获取，前端按 `providerId` 过滤

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| plan | `docs/plan/PROVIDER_TEST_DIALOG_PLAN.md` |
| development | `docs/development/PROVIDER_TEST_DIALOG_REQ-001_DEVELOPMENT.md` |