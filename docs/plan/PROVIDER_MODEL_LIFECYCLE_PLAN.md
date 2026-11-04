# 渠道/模型生命周期（禁用 / 启用 / 删除）开发计划（PROVIDER_MODEL_LIFECYCLE）

> 把「渠道 / 模型」的删除动作拆分为 **禁用（软禁用，可恢复）** 与 **删除（硬删除，不可恢复）** 两个动作，并补齐「启用」恢复入口；渠道硬删除时级联删除其下所有模型（含僵尸模型）。
>
> - 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（§5.2 组件边界）、`docs/technical/db_schema/MODEL_PROVIDER_SCHEMA.MD`
> - 定稿时间：2026-11-04
> - 状态：`done`

---

## 1. 需求背景

1. 现状：渠道与模型的 `DELETE /:id` 实际是「软禁用」（置 `status=disabled`），既无真正的删除，也没有「启用」恢复入口；前端只暴露一个「删除」按钮。
2. 上一轮 fix（`2026-11-04-provider-disable-cascade`）已让「禁用渠道」级联软禁用其下模型，解决了「僵尸模型」在转发层可见/可用不一致的问题，但缺少硬删除能力。
3. 用户诉求：删除动作提供「禁用」与「删除」两个选项——禁用可恢复，删除直接删除（渠道删除时连其下模型一并删除）。

## 2. 目标

1. 渠道：`disable`（软禁用 + 级联软禁用模型）/ `enable`（启用 + 级联启用模型）/ `delete`（硬删除 + 级联硬删除模型）。
2. 模型：`disable`（软禁用）/ `enable`（启用）/ `delete`（硬删除）。
3. 前端渠道页、模型页均提供「禁用 / 启用 + 删除」动作，删除二次确认并明确级联影响。
4. 审计：新增 `enable`、`delete` 动作类型，禁用/启用/删除各自留痕。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 渠道禁用 | `POST /providers/:id/disable` → 软禁用渠道 + `ModelsService.disableByProvider` 级联软禁用其下模型 |
| 渠道启用 | `POST /providers/:id/enable` → 启用渠道 + `ModelsService.enableByProvider` 级联启用其下模型 |
| 渠道删除 | `DELETE /providers/:id` → `ModelsService.deleteByProvider` 级联硬删除其下模型，再硬删除渠道自身 |
| 模型禁用/启用 | `POST /models/:id/disable` / `POST /models/:id/enable` → 置 `status` |
| 模型删除 | `DELETE /models/:id` → 硬删除（`deleteOne`） |
| 审计动作 | `AuditAction` 新增 `enable`、`delete`；前端 `AuditAction` 联合类型与 `ACTION_LABELS` 同步 |
| RBAC | 写操作 `team_admin`（沿用现有 `@Roles(Role.TEAM_ADMIN)`） |
| 历史数据 | 硬删除渠道/模型后，`usagelogs` 等历史流水中的 `providerId`/`modelId` 保留原值（历史留痕，不做级联清理） |

### 语义取舍

- 「启用渠道」会连带重新启用其下模型。系统不区分「级联禁用」与「单独禁用」，因此若用户单独禁用过某模型，再对渠道整体「禁用 → 启用」会将其重新启用。此取舍已与用户确认。

## 4. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [PROVIDER_MODEL_LIFECYCLE_REQ-001](../requirement/PROVIDER_MODEL_LIFECYCLE_REQ-001_BACKEND_PROVIDER.md) | 后端：渠道 disable/enable/delete（级联）+ 审计动作 `enable`/`delete` | 三端点行为正确（级联禁用/启用/硬删）；审计留痕；lint/typecheck/test 通过 |
| [PROVIDER_MODEL_LIFECYCLE_REQ-002](../requirement/PROVIDER_MODEL_LIFECYCLE_REQ-002_BACKEND_MODEL.md) | 后端：模型 disable/enable/delete | 三端点行为正确（软禁用/启用/硬删）；审计留痕；lint/typecheck/test 通过 |
| [PROVIDER_MODEL_LIFECYCLE_REQ-003](../requirement/PROVIDER_MODEL_LIFECYCLE_REQ-003_FRONTEND.md) | 前端：渠道页 + 模型页「禁用/启用 + 删除」+ 删除二次确认 + 审计文案 | 两页按状态显示禁用/启用/删除；删除二次确认含级联提示；lint/typecheck/build 通过 |

## 5. 里程碑

1. ✅ REQ-001 后端渠道生命周期（disable/enable/delete + 级联 + 审计）。
2. ✅ REQ-002 后端模型生命周期（disable/enable/delete + 审计）。
3. ✅ REQ-003 前端渠道/模型页 UI + 审计文案。

## 6. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| C-01 | `DELETE /:id` 语义由「软禁用」改为「硬删除」，为破坏性变更 | 已同步前端：删除走硬删 + 二次确认；禁用走新 `disable` 端点 |
| C-02 | 硬删除后历史 `usagelogs` 保留悬空 `providerId`/`modelId` | 接受（历史留痕）；不做级联清理 |
| C-03 | 启用渠道级联启用模型（含曾单独禁用的模型） | 已确认接受（见 §3 语义取舍） |

## 7. 关联

- 上游：`MODEL_PROVIDER_PLAN.md`、`USAGE_METERING_PLAN.md`（转发层）
- feature：`docs/feature/model_provider.md`、`docs/feature/usage_metering.md`
- requirement：见 §4
