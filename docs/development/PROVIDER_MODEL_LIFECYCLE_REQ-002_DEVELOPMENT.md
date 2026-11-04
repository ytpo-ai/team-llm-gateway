# PROVIDER_MODEL_LIFECYCLE_REQ-002 开发记录（后端：模型 禁用/启用/删除）

> 对应需求：`docs/requirement/PROVIDER_MODEL_LIFECYCLE_REQ-002_BACKEND_MODEL.md`
> 对应计划：`docs/plan/PROVIDER_MODEL_LIFECYCLE_PLAN.md`

## 1. 实现摘要

把模型 `DELETE /models/:id` 从「软禁用」改为「硬删除」，并新增「禁用」「启用」两个动作：

- `POST /models/:id/disable`：软禁用模型。
- `POST /models/:id/enable`：启用模型。
- `DELETE /models/:id`：硬删除模型（`deleteOne`）。
- 三个动作分别落审计（disable/enable/delete，复用 REQ-001 新增的 `AuditAction`）。

## 2. 代码改动点

| 文件 | 说明 |
|---|---|
| `modules/models/models.service.ts` | `disable`（软禁）/ `enable`（启用）/ `remove`（硬删 `deleteOne`） |
| `modules/models/models.controller.ts` | `POST :id/disable`、`POST :id/enable`、`DELETE :id`（改硬删）；审计 `DISABLE/ENABLE/DELETE` |
| `modules/models/models.service.spec.ts` | `remove` 改硬删用例；新增 `disable`/`enable`、`enableByProvider`、`deleteByProvider` 用例；mock 增 `deleteOne`/`deleteMany` |

## 3. 踩坑记录

1. `remove` 原为软禁用、被复用为硬删除后，原先「删除按钮=软禁」的前端语义同步拆为「禁用 + 删除」两个动作（见 REQ-003）。
2. 模型硬删除不涉及级联（模型是叶子节点），只做 `deleteOne`；渠道级联删除由 `ModelsService.deleteByProvider` 负责（REQ-001）。

## 4. 验证结果

- 后端：typecheck 通过、lint 0/0、test 190 passed。

## 5. 关联

- feature：`docs/feature/model_provider.md`
- 计划：`docs/plan/PROVIDER_MODEL_LIFECYCLE_PLAN.md`
