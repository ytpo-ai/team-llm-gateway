# PROVIDER_MODEL_LIFECYCLE_REQ-003 前端：渠道/模型页 禁用 / 启用 / 删除

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/model_provider.md` |
| 所属 plan | `docs/plan/PROVIDER_MODEL_LIFECYCLE_PLAN.md` |
| 状态 | `done` |

## 2. 需求描述

### 背景
渠道页、模型页目前只有一个「删除」按钮（实为软禁用）；需按后端新端点提供「禁用 / 启用 + 删除」。

### 目标
- 渠道页（`pages/providers.tsx`）：
  - `active` 渠道显示「禁用」「删除」；`disabled` 渠道显示「启用」「删除」。
  - 「删除」二次确认，明确提示「将永久删除该渠道及其下所有模型，不可恢复」。
- 模型页（`pages/models.tsx`）：
  - `active` 模型显示「禁用」「删除」；`disabled` 模型显示「启用」「删除」。
  - 「删除」二次确认提示「永久删除」。
- API 层新增 `disableProvider/enableProvider/deleteProvider`、`disableModel/enableModel/deleteModel`（移除旧 `removeProvider/removeModel`）。
- 审计日志页 `ACTION_LABELS` 补 `enable`/`delete` 文案；`AuditAction` 联合类型同步。

### 验收条件
- [ ] 渠道页/模型页按状态显示「禁用/启用 + 删除」；删除二次确认。
- [ ] 删除渠道提示级联删除模型。
- [ ] `pnpm --filter portal-frontend lint` / `typecheck` / `build` 通过。

## 3. 技术方案摘要

- `features/providers/api.ts`、`features/models/api.ts`：替换 `removeX` 为 `disableX` / `enableX` / `deleteX`（分别映射 `POST .../disable`、`POST .../enable`、`DELETE ...`）。
- `features/system/types.ts`：`AuditAction` 增 `'enable'`、`'delete'`。
- `pages/audit-logs.tsx`：`ACTION_LABELS` 增 `enable: '启用'`、`delete: '删除'`。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/PROVIDER_MODEL_LIFECYCLE_REQ-003_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
