# PROVIDER_MODEL_LIFECYCLE_REQ-002 后端：模型 禁用 / 启用 / 删除

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/model_provider.md` |
| 所属 plan | `docs/plan/PROVIDER_MODEL_LIFECYCLE_PLAN.md` |
| 状态 | `done` |

## 2. 需求描述

### 背景
模型现有 `DELETE /models/:id` 实为软禁用，无硬删除与启用恢复入口。

### 目标
- `POST /models/:id/disable`：软禁用模型。
- `POST /models/:id/enable`：启用模型。
- `DELETE /models/:id`：硬删除模型。
- 三个动作分别落审计（disable/enable/delete，复用 REQ-001 新增的 `AuditAction`）。

### 验收条件
- [ ] `disable` 后模型 `disabled`，`enable` 后 `active`。
- [ ] `DELETE` 后模型从库中移除。
- [ ] 模型不存在时各端点返回 404。
- [ ] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过。

## 3. 技术方案摘要

- `ModelsService`：`disable`（软禁用）、`enable`（启用）、`remove`（硬删 `deleteOne`）。
- `ModelsController`：`POST :id/disable`、`POST :id/enable`、`DELETE :id`（改硬删）；`AuditAction.DISABLE / ENABLE / DELETE`。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/PROVIDER_MODEL_LIFECYCLE_REQ-002_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
