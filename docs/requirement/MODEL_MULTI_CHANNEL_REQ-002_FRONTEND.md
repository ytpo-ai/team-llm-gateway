# MODEL_MULTI_CHANNEL_REQ-002 前端渠道展示与优先级管理

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/model_provider.md` |
| 所属 plan | `docs/plan/MODEL_MULTI_CHANNEL_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/model-multi-channel-frontend` |
| 状态 | `in-progress` |

## 2. 需求描述

### 背景
后端已支持模型多渠道绑定，前端需要展示和管理这些绑定关系。

### 目标
- 类型定义更新：`ProviderBinding` 类型，`Model` 增加 `providerBindings`
- 模型列表新增"渠道"列：展示所有绑定渠道标签及优先级，主渠道（providerId）高亮
- 模型编辑/创建表单：支持多渠道选择 + 数字优先级输入
- API 层适配：`ModelInput/ModelPatch` 增加 `providerBindings`

### 验收条件
- [ ] `pnpm --filter portal-frontend build` 通过
- [ ] 模型列表页正确展示每个模型的绑定渠道标签和优先级
- [ ] 添加/编辑模型时可选择多个渠道并设置优先级
- [ ] 无 `providerBindings` 的存量模型正常回退显示

## 3. 技术方案摘要
- 复用既有 React + Tailwind + Radix UI 模式
- 渠道标签使用 `Badge` 组件样式，带优先级数字和渠道名称
- 编辑表单中使用多选 Select + 每项带优先级 Input
- `toForm` / `fromForm` 适配多渠道数据

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/MODEL_MULTI_CHANNEL_REQ-002_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [ ] 开发中
- [ ] 待验收
- [ ] 已交付