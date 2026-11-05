# MODEL_MULTI_CHANNEL_REQ-001 后端多渠道绑定与级联适配

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/model_provider.md` |
| 所属 plan | `docs/plan/MODEL_MULTI_CHANNEL_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/model-multi-channel-backend` |
| 状态 | `done` |

## 2. 需求描述

### 背景
当前 `Model.providerId` 是一对一关系，无法支持同一模型通过多个渠道访问并设置优先级的场景。

### 目标
- Model Schema 新增 `ProviderBinding` 子文档：`{ providerId: ObjectId, priority: number }`，新增 `providerBindings` 数组字段
- 保留 `providerId` 向后兼容，`providerBindings` 为空时自动从 `providerId` 回退
- DTO 新增 `ProviderBindingDto`，`CreateModelDto` 和 `UpdateModelDto` 支持 `providerBindings`
- Service：`create/update/list` 支持 bindings；`list()` populate provider 摘要信息
- 级联适配：Provider `remove()` 移除 binding 而非删除模型；Provider `disable()` 不级联禁用模型
- 审计日志适配

### 验收条件
- [x] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过
- [x] `start:dev` 启动，Swagger 可调用 create/update/list 接口并正确返回 `providerBindings`
- [x] 删除 Provider 后，相关 Model 的 binding 被移除，若无剩余 binding 则模型被禁用
- [x] 存量无 `providerBindings` 的 Model，list 返回时自动从 `providerId` 回退

## 3. 技术方案摘要
- 复用既有 Nest.js + Mongoose + class-validator 模式
- `ProviderBinding` 子 Schema 不独立建表，嵌入在 Model 文档中
- `list()` 返回时 populate `providerBindings.providerId` 的 name/status
- 级联逻辑调整：`providers.service.ts` 的 `remove()` 改为调用 `modelsService.removeProviderBinding()` 而非 `deleteByProvider()`

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/MODEL_MULTI_CHANNEL_REQ-001_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付