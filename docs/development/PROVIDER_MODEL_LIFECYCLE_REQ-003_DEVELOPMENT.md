# PROVIDER_MODEL_LIFECYCLE_REQ-003 开发记录（前端：渠道/模型页 禁用/启用/删除）

> 对应需求：`docs/requirement/PROVIDER_MODEL_LIFECYCLE_REQ-003_FRONTEND.md`
> 对应计划：`docs/plan/PROVIDER_MODEL_LIFECYCLE_PLAN.md`

## 1. 实现摘要

渠道页与模型页把单一的「删除」按钮拆为「禁用 / 启用 + 删除」三态动作，删除做二次确认并提示级联影响。

- 渠道页（`pages/providers.tsx`）：active 显示「禁用 + 删除」，disabled 显示「启用 + 删除」；删除二次确认提示「将永久删除该渠道及其下所有模型」。
- 模型页（`pages/models.tsx`）：active 显示「禁用 + 删除」，disabled 显示「启用 + 删除」；删除二次确认提示「永久删除」。
- API 层新增 `disableProvider/enableProvider/deleteProvider`、`disableModel/enableModel/deleteModel`（移除旧 `removeProvider/removeModel`）。
- 审计日志页 `ACTION_LABELS` 补 `enable: '启用'`、`delete: '删除'`；`AuditAction` 联合类型同步。

## 2. 代码改动点

| 文件 | 说明 |
|---|---|
| `features/providers/api.ts` | `removeProvider` → `disableProvider` / `enableProvider` / `deleteProvider` |
| `features/models/api.ts` | `removeModel` → `disableModel` / `enableModel` / `deleteModel` |
| `pages/providers.tsx` | 动作按钮三态；确认弹窗支持 disable/delete 两种；`enableProviderMutation`（避免与官方渠道 `enableMutation` 重名） |
| `pages/models.tsx` | 动作按钮三态；确认弹窗支持 disable/delete 两种 |
| `features/system/types.ts` | `AuditAction` 增 `'enable'`、`'delete'` |
| `pages/audit-logs.tsx` | `ACTION_LABELS` 增 `enable`、`delete` |

## 3. 踩坑记录

1. `providers.tsx` 已有「官方渠道开启」的 `enableMutation`，新增「启用渠道」mutation 需命名 `enableProviderMutation` 避免同作用域重名（TS2451）。
2. 启用为非破坏性动作，直接执行不弹确认；禁用/删除共用一个确认弹窗，通过 `kind: 'disable' | 'delete'` 区分标题、文案与按钮样式（删除用 destructive 红底）。

## 4. 验证结果

- 前端：typecheck 通过、lint（仅 2 条既有 warning）、build 通过。

## 5. 关联

- feature：`docs/feature/model_provider.md`
- 计划：`docs/plan/PROVIDER_MODEL_LIFECYCLE_PLAN.md`
