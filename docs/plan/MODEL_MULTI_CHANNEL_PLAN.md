# 模型多渠道绑定与渠道优先级管理（MODEL_MULTI_CHANNEL）

> 本 plan 在现有 `Model` 与 `Provider` 一对一关系基础上，扩展为多渠道绑定，支持渠道优先级管理。
>
> - 上游 plan：`docs/plan/MODEL_PROVIDER_PLAN.md`
> - feature：`docs/feature/model_provider.md`
> - 定稿时间：2026-11-06
> - 状态：已完成

---

## 1. 需求背景

当前 `Model.providerId` 是一对一关系：一个模型只能归属于一个上游渠道。但实际场景中，同一个模型（如 DeepSeek V4 Pro）可通过多个渠道访问（如阿里云 Token Plan、DeepSeek 官方 API 等）。需要在模型列表中展示所有绑定的渠道，并能设置渠道优先级，网关在转发时按优先级选择渠道。

## 2. 目标

1. Model Schema 新增 `providerBindings: [{ providerId, priority }]` 数组，支持一个模型绑定多个渠道。
2. 保留现有 `providerId` 作为主渠道（向后兼容），`providerBindings` 为空时自动从 `providerId` 回退。
3. 前端模型列表新增"渠道"列，展示所有绑定渠道标签及优先级。
4. 前端编辑表单支持多渠道选择 + 数字优先级输入。
5. 级联操作适配：Provider 禁用/删除时移除对应 binding，而非直接删/禁用模型。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 数据模型 | Model 新增 `ProviderBinding` 子文档：`{ providerId: ObjectId, priority: number }`；`providerBindings: [ProviderBinding]` |
| 向后兼容 | `providerId` 字段保留不变；当 `providerBindings` 为空时，前端/网关从 `providerId` 回退为单一渠道 |
| 优先级语义 | `priority` 数值越小优先级越高，0 = 最高。同模型下 priority 不可重复 |
| 级联行为变更 | 禁用 Provider → 不自动禁用模型（模型仍可通过其他渠道使用）；删除 Provider → 移除该渠道的 binding，若无剩余 binding 则禁用模型 |
| 列表查询 | `list()` 返回时 populate `providerBindings.providerId` 的 `name`、`status` 等摘要信息 |

## 4. 影响范围

### 后端

| 文件 | 改动 |
|---|---|
| `schemas/model.schema.ts` | 新增 `ProviderBinding` 子 Schema |
| `dto/create-model.dto.ts` | 新增 `ProviderBindingDto`，`providerBindings` 可选字段 |
| `dto/update-model.dto.ts` | 新增 `providerBindings` 可选字段 |
| `models.service.ts` | `ModelView` 增加 `providerBindings`；CRUD 支持 bindings；级联适配 |
| `models.controller.ts` | 透传 bindings |
| `providers.service.ts` | `remove()` 移除 binding 而非删除模型 |

### 前端

| 文件 | 改动 |
|---|---|
| `features/models/types.ts` | 新增 `ProviderBinding` 类型，`Model` 增加 `providerBindings` |
| `features/models/api.ts` | `ModelInput/ModelPatch` 增加 `providerBindings` |
| `pages/models.tsx` | 列表新增渠道标签列；编辑表单支持多渠道选择+优先级输入 |

## 5. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [MODEL_MULTI_CHANNEL_REQ-001](../requirement/MODEL_MULTI_CHANNEL_REQ-001_BACKEND.md) | 后端：Schema 扩展、DTO 更新、Service 多渠道 CRUD、级联适配、列表 populate | lint/typecheck 通过，API 可创建/更新多渠道绑定模型 |
| [MODEL_MULTI_CHANNEL_REQ-002](../requirement/MODEL_MULTI_CHANNEL_REQ-002_FRONTEND.md) | 前端：类型更新、模型列表渠道标签列、编辑表单多渠道选择+优先级输入 | build 通过，列表展示渠道标签，编辑可管理多渠道 |

## 6. 里程碑

1. ✅ REQ-001 后端多渠道绑定与级联适配
2. ✅ REQ-002 前端渠道展示与优先级管理

## 7. 风险

| 编号 | 事项 | 状态 |
|---|---|---|
| R-01 | 级联行为变化：删除 Provider 不再删除 Model，依赖方（如 proxy 转发层）是否受影响 | 需排查 proxy 模块 `resolveAdapter` 及模型选择逻辑 |
| R-02 | 存量数据：现有 Model 无 `providerBindings`，查询时需从 `providerId` 回退 | 代码层兜底，无需数据迁移 |

## 8. 关联

- 上游：`MODEL_PROVIDER_PLAN.md`
- feature：`docs/feature/model_provider.md`
- 级联：`PROVIDER_MODEL_LIFECYCLE_PLAN.md`