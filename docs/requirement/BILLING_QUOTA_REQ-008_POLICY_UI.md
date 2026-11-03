# BILLING_QUOTA_REQ-008 策略管理 UI + 现有限制 UI 改造

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/billing_quota.md`、`docs/feature/team_member.md`、`docs/feature/api_key.md` |
| 所属 plan | `docs/plan/BILLING_QUOTA_POLICY_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `main` |
| 状态 | `done` |

## 2. 需求描述

### 背景
REQ-006/007 已落地策略数据模型与求值引擎。本期落地前端：新增策略管理页（策略集 CRUD + 条目编辑器），并将角色/团队/Key 的现有限制设置 UI 由「固定字段」改造为「绑定策略集」。

### 目标
- 新增策略管理页（`/policy-sets`，`team_admin`/`system` 可见）：
  - 策略集列表（名称/描述/内置标识/条目摘要）。
  - 新建/编辑策略集：名称、描述、范围（渠道白名单 `providerIds`、模型白名单 `modelWhitelist`）、条目编辑器（增删改，`measure/window/limit/action` 下拉选择）。
  - 删除策略集（内置不可删）。
- 改造现有设置 UI：
  - **角色管理页**（`roles.tsx`）：移除日/周/月 token、速率、模型白名单等固定字段输入，改为「选择策略集」。
  - **团队设置页**（`team.tsx`）：移除日/周/月 token 固定字段，改为「选择策略集」。
  - **API Key 页**（`api-keys.tsx`）：移除 allowedModels/rateLimit/maxTokens/日周月 固定字段，改为「选择策略集」。
- 新增 `features/policy-sets/`（types/api），`getPolicySets`/`createPolicySet`/`updatePolicySet`/`deletePolicySet`。

### 验收条件
- [ ] `pnpm --filter portal-frontend dev` / `build` 通过。
- [ ] 策略管理页可增删改策略集与条目，内置集不可删。
- [ ] 角色/团队/Key 页通过「选择策略集」配置限制，保存后求值引擎按策略生效。
- [ ] 未绑定策略集时回退「不限」，不报错。
- [ ] `pnpm --filter portal-frontend lint` 通过。

## 3. 技术方案摘要
- 复用 `@tanstack/react-query`、shadcn 组件（`Card`/`Input`/`Select`/`Sheet`/`Dialog`/`AlertDialog`），参考 `roles.tsx` 现有 Sheet 表单模式。
- 条目编辑器为动态列表（`entries.map`），`measure/window/action` 用 `Select`，`limit` 用 `Input`。
- 角色/团队/Key 选择策略集用 `Select`（含「不限」空项）。
- 结构详见 `docs/plan/BILLING_QUOTA_POLICY_PLAN.md` §3。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/BILLING_QUOTA_REQ-008_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
