# API_KEY_REQ-004 前端成员绑定与展示

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/api_key.md` |
| 所属 plan | `docs/plan/API_KEY_MEMBER_BINDING_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/api-key-member-binding` |
| 状态 | `in-review` |

## 2. 需求描述

### 背景
后端已支持 apikey 绑定成员（REQ-003）。前端 API Key 管理需支持 team_admin 在创建/编辑时选择成员，并在列表展示绑定成员。

### 目标
- 创建/编辑表单（team_admin 视角）增加成员选择器（拉取团队成员列表）。
- 列表增加「成员」列，展示绑定成员姓名。
- `types.ts`/`api.ts` 增加 `userId`/`userName`/`userEmail` 字段与成员列表请求。

### 验收条件
- [ ] team_admin 创建/编辑 API Key 可选绑定成员。
- [ ] member 视角不显示成员选择器（或禁用）。
- [ ] 列表展示绑定成员姓名。
- [ ] `pnpm --filter portal-frontend lint` / `build` 通过。

## 3. 技术方案摘要
- 复用 `GET /teams/:teamId/members` 拉取成员；表单用下拉选择。
- `api-keys` feature 的 `types.ts`/`api.ts` 与 `pages/api-keys.tsx` 同步扩展。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/API_KEY_REQ-004_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [ ] 已交付
