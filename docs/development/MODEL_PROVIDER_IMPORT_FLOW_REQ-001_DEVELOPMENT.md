# MODEL_PROVIDER_IMPORT_FLOW_REQ-001 开发记录（渠道模型导入流程优化）

> 对应需求：`docs/requirement/MODEL_PROVIDER_IMPORT_FLOW_REQ-001_IMPORT_FLOW.md`
> 对应计划：`docs/plan/MODEL_PROVIDER_IMPORT_FLOW_PLAN.md`
> 分支：`main`

## 1. 实现摘要

将渠道创建后的自动全量导入改为引导式批量测试后导入，支持多渠道绑定，统一弹窗交互体验。

- 后端 `POST /providers/from-preset` 移除自动导入逻辑，仅创建渠道
- 后端 `ModelsService.bulkCreate()` 支持已存在模型追加多渠道绑定
- 前端创建预置渠道后弹窗（Dialog）引导：勾选/全选 → 批量测试 → 仅通过模型导入
- 已存在模型导入时自动追加为 `providerBinding`，模型卡片显示多渠道标签
- 渠道列表操作列「测试」改为「导入模型」
- 模型管理页移除「官方预设导入」按钮
- 导入交互从 Sheet 侧边栏统一为 Dialog 居中弹窗

## 2. 代码改动点

### 后端

| 文件 | 说明 |
|---|---|
| `providers.service.ts` | `createFromPreset()` 移除 `modelsService.bulkCreate()` 调用，仅返回 `ProviderView`；删除 `CreateFromPresetResult` 接口；`syncPresetModels` 适配新 `BulkCreateResult` |
| `providers.controller.ts` | `createFromPreset` 适配新返回值，审计日志不再包含导入模型数 |
| `providers.service.spec.ts` | `createFromPreset` 测试适配：不再预期 `bulkCreate` 调用；`result.provider.name` → `result.name` |
| `models.service.ts` | `BulkCreateResult` 新增 `bound: ModelView[]`；`bulkCreate()` 已存在模型时检查是否已绑定该 provider，未绑定则追加 `providerBinding` |

### 前端

| 文件 | 说明 |
|---|---|
| `features/providers/types.ts` | `CreateProviderFromPresetResult` 改为 `Provider` 别名 |
| `features/models/api.ts` | `BulkCreateModelsResult` 新增 `bound` 字段 |
| `pages/providers.tsx` | 预置开启 `onSuccess` 打开导入弹窗；`importedModelIdSet` 同时检查 `providerBindings`；"测试"→"导入模型"；导入完成显示"新增 X 个，绑定 Y 个"反馈；Sheet→Dialog；移除 `enableResult` |
| `pages/models.tsx` | 移除"官方预设导入"按钮及相关代码（state、query、mutation、Sheet） |

### 文档

| 文件 | 说明 |
|---|---|
| `docs/plan/MODEL_PROVIDER_IMPORT_FLOW_PLAN.md` | 新增 plan 文档 |
| `docs/requirement/MODEL_PROVIDER_IMPORT_FLOW_REQ-001_IMPORT_FLOW.md` | 新增 requirement 文档 |
| `docs/feature/model_provider.md` | 追溯表新增 plan 行 |

## 3. 关键设计决策

| 决策 | 说明 |
|---|---|
| 批量测试复用现有 drawer | 原测试抽屉已支持全选/批量测试/导入通过模型，直接复用为导入弹窗，仅改容器组件和标题 |
| 已存在模型不跳过，追加绑定 | 而非 `skip`。同一 `modelId` 跨渠道共享时，新渠道作为 `providerBinding` 追加，模型卡片显示多渠道标签 |
| `importedModelIdSet` 同时检查主键和 bindings | 不仅 `providerId`，也检查 `providerBindings[].providerId`，避免已绑定模型重复导入 |
| 弹窗统一为 Dialog | 与添加渠道、自定义渠道、开启预置弹窗保持一致，侧边栏仅保留编辑渠道 |

## 4. 验证

- [x] 后端 typecheck / lint / test(252) 通过
- [x] 前端 typecheck / lint / build 通过
- [x] 创建预置渠道后不自动导入模型，弹出导入对话框
- [x] 全选/单选/批量测试/导入通过模型 流程闭环
- [x] 仅测试通过的模型导入
- [x] 已存在模型追加为多渠道绑定，模型卡片显示绑定标签
- [x] 渠道列表"导入模型"按钮可用
- [x] 模型管理页无"官方预设导入"按钮