# MODEL_MULTI_CHANNEL_REQ-001 开发记录（后端多渠道绑定与级联适配）

> 对应需求：`docs/requirement/MODEL_MULTI_CHANNEL_REQ-001_BACKEND.md`
> 对应计划：`docs/plan/MODEL_MULTI_CHANNEL_PLAN.md`
> 分支：`main`

## 1. 实现摘要

在现有 `Model.providerId` 一对一关系基础上扩展为多渠道绑定：`Model` 新增 `ProviderBinding` 子文档（`{ providerId, priority }`）和 `providerBindings` 数组字段，支持一个模型绑定多个上游渠道并设置数字优先级（越小越高）。同时适配级联行为：Provider 禁用不再级联禁用模型，Provider 删除时移除绑定而非删除模型。

- Schema：`ProviderBinding` 子 Schema `{ _id: false }` 嵌入 Model 文档，`providerId` ref `Provider`，`priority` number 默认 0。
- DTO：`ProviderBindingDto`（`providerId` + `priority`），`CreateModelDto` / `UpdateModelDto` 新增 `providerBindings` 可选数组字段。
- Service：`create/update` 校验所有绑定 provider 归属；`list` 批量 resolve provider 名称到 `ProviderBindingView`；`providerBindings` 空时从 `providerId` 回退（向后兼容）。
- 级联：`disableByProvider/enableByProvider` 不再执行级联操作（返回 0）；`deleteByProvider` 委托给新的 `removeProviderBinding`，移除绑定后若无剩余则禁用模型；Provider 删除时自动选择最高优先级剩余绑定作为新主渠道。
- 审计日志：Controller 无需变更（DTO 字段自动透传）。

## 2. 代码改动点

### 修改

| 文件 | 说明 |
|---|---|
| `schemas/model.schema.ts` | 新增 `ProviderBinding` 子 Schema；`Model` 新增 `providerBindings` 字段 |
| `dto/create-model.dto.ts` | 新增 `ProviderBindingDto`；`providerBindings` 可选字段 |
| `dto/update-model.dto.ts` | 新增 `providerBindings` 可选字段 |
| `models.service.ts` | `ModelView.providerBindings`；`resolveBindings` 批量查询 provider 名称；`create/update/list` 支持 bindings；`removeProviderBinding` 新方法；`disableByProvider/enableByProvider` 空操作 |
| `models.controller.ts` | 无变更（DTO 自动透传） |
| `models.service.spec.ts` | 新增/更新 12 例（create with bindings、update bindings、removeProviderBinding、list 含 bindings、级联无操作等） |
| `providers.service.ts` | `remove` 调 `removeProviderBinding`；`disable/enable` 移除级联调用 |
| `providers.service.spec.ts` | 更新 3 例（remove/disable/enable 适配多渠道行为） |

## 3. 踩坑记录

1. **`toView` 异步化**：`toView` 需要查询 provider 名称，改为 `async`。存量调用点（`remove`）不需要名称解析，传入 `false` 跳过。
2. **Mongoose 嵌入子文档的 populate**：嵌入子文档 `providerBindings.providerId` 可使用 `ref` 声明关联，但 `populate` 后 TypeScript 类型不变。选择在 `toView` 外通过 `resolveBindings` 函数批量 `providerModel.find({ _id: { $in }})` 查询，避免 populate 类型复杂。
3. **级联语义变更**：`disableByProvider/enableByProvider` 不再执行级联但保留方法签名（返回 0），避免调用方（providers.service）编译错误。Test 中改为 assert `not.toHaveBeenCalled()`。

## 4. 验证结果

- `pnpm --filter portal-backend lint`：0 errors / 0 warnings。
- `pnpm --filter portal-backend typecheck`：通过。
- `pnpm --filter portal-backend test`：215 passed（25 files）。
- `pnpm --filter portal-backend build`：通过。

## 5. 关联

- feature：`docs/feature/model_provider.md`
- 上游 plan：`docs/plan/MODEL_PROVIDER_PLAN.md`
- 级联：`docs/plan/PROVIDER_MODEL_LIFECYCLE_PLAN.md`