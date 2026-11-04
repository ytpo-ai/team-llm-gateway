# PROVIDER_MODEL_LIFECYCLE_REQ-001 开发记录（后端：渠道 禁用/启用/删除）

> 对应需求：`docs/requirement/PROVIDER_MODEL_LIFECYCLE_REQ-001_BACKEND_PROVIDER.md`
> 对应计划：`docs/plan/PROVIDER_MODEL_LIFECYCLE_PLAN.md`

## 1. 实现摘要

把渠道 `DELETE /providers/:id` 从「软禁用」改为「硬删除」，并新增「禁用」「启用」两个动作：

- `POST /providers/:id/disable`：软禁用渠道 + `ModelsService.disableByProvider` 级联软禁用其下模型。
- `POST /providers/:id/enable`：启用渠道 + `ModelsService.enableByProvider` 级联启用其下模型。
- `DELETE /providers/:id`：`ModelsService.deleteByProvider` 级联硬删除其下模型，再 `deleteOne` 硬删除渠道。
- `AuditAction` 新增 `enable`、`delete`，三个动作分别落审计（disable/enable/delete）。

## 2. 代码改动点

| 文件 | 说明 |
|---|---|
| `modules/providers/providers.service.ts` | `disable`（软禁+级联禁用）/ `enable`（启用+级联启用）/ `remove`（硬删+级联删除） |
| `modules/providers/providers.controller.ts` | `POST :id/disable`、`POST :id/enable`、`DELETE :id`（改硬删）；审计 `DISABLE/ENABLE/DELETE` |
| `modules/models/models.service.ts` | 新增 `enableByProvider`（软启已禁用模型）、`deleteByProvider`（硬删全部模型） |
| `modules/system/schemas/audit-log.schema.ts` | `AuditAction` 新增 `ENABLE`、`DELETE` |
| `modules/providers/providers.service.spec.ts` | 改 `remove` 为硬删用例；新增 `disable`/`enable` 级联用例；mock 增 `deleteOne`、`enableByProvider`、`deleteByProvider` |

## 3. 踩坑记录

1. `DELETE` 语义由「软禁用」改为「硬删除」是破坏性变更，前端同步移除旧 `removeProvider`，改用 `disableProvider/enableProvider/deleteProvider` 三分支。
2. `enableByProvider` 只启用 `status=disabled` 的模型（过滤条件），避免无谓改写已 active 的记录；`deleteByProvider` 不加 status 过滤，删除该渠道下所有模型（含僵尸模型）。
3. 硬删除后历史 `usagelogs` 保留原 `providerId`/`modelId`（历史留痕，不做级联清理，见 plan C-02）。

## 4. 验证结果

- 后端：typecheck 通过、lint 0/0、test 190 passed。

## 5. 关联

- feature：`docs/feature/model_provider.md`
- 计划：`docs/plan/PROVIDER_MODEL_LIFECYCLE_PLAN.md`
