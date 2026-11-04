# PROVIDER_MODEL_LIFECYCLE_REQ-001 后端：渠道 禁用 / 启用 / 删除（级联）

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/model_provider.md` |
| 所属 plan | `docs/plan/PROVIDER_MODEL_LIFECYCLE_PLAN.md` |
| 状态 | `done` |

## 2. 需求描述

### 背景
渠道现有 `DELETE /providers/:id` 实为软禁用，无硬删除与启用恢复入口；删除动作需拆为「禁用（可恢复）」与「删除（硬删，级联删模型）」。

### 目标
- `POST /providers/:id/disable`：软禁用渠道，并级联软禁用其下 `active` 模型。
- `POST /providers/:id/enable`：启用渠道（`status=active`），并级联启用其下模型。
- `DELETE /providers/:id`：硬删除渠道，并级联硬删除其下所有模型（含已禁用/僵尸模型）。
- `AuditAction` 新增 `enable`、`delete`；三个动作分别落审计（disable/enable/delete）。

### 验收条件
- [ ] `POST /providers/:id/disable` 后渠道与模型均 `disabled`；`enable` 后均 `active`。
- [ ] `DELETE /providers/:id` 后渠道与其下所有模型均从库中移除。
- [ ] 渠道不存在时各端点返回 404。
- [ ] 审计动作 `enable` / `delete` 可落库。
- [ ] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过。

## 3. 技术方案摘要

- `ProvidersService`：`disable`（软禁用 + `modelsService.disableByProvider`）、`enable`（启用 + `modelsService.enableByProvider`）、`remove`（硬删 + `modelsService.deleteByProvider`）。
- `ModelsService` 新增 `enableByProvider` / `deleteByProvider`；`disableByProvider` 已有。
- `ProvidersController`：`POST :id/disable`、`POST :id/enable`、`DELETE :id`（改硬删）；`AuditAction.DISABLE / ENABLE / DELETE`。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/PROVIDER_MODEL_LIFECYCLE_REQ-001_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
