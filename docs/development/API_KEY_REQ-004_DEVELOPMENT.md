# API_KEY_REQ-004 开发记录（前端成员绑定与展示）

> 对应需求：`docs/requirement/API_KEY_REQ-004_FRONTEND_MEMBER_BINDING.md`
> 对应计划：`docs/plan/API_KEY_MEMBER_BINDING_PLAN.md`
> 分支：`feat/api-key-member-binding`（提交 `18acea4`）

## 1. 实现摘要

前端 API Key 管理页支持成员绑定与展示：

- 类型扩展：`ApiKey` 新增 `userName`/`userEmail`；`ApiKeyInput`/`ApiKeyPatch` 新增 `userId`。
- 成员选择器：`team_admin`/`system` 视角在创建/编辑表单显示「绑定成员」下拉（复用 `GET /teams/:teamId/members`），`member` 视角不显示。
- 列表展示：新增「成员」列，展示 `userName`/`userEmail`。
- 提交时透传 `userId`（空则后端回退本人绑定）。

## 2. 代码改动点

### 修改

| 文件 | 说明 |
|---|---|
| `features/api-keys/types.ts` | `ApiKey` 增加 `userName`/`userEmail`；`ApiKeyInput`/`ApiKeyPatch` 增加 `userId` |
| `pages/api-keys.tsx` | 成员选择器（Select）、成员列表查询、成员列展示、提交透传 `userId` |

## 3. 踩坑记录

1. **「默认：我自己」选项**：创建时 `userId` 为空表示绑定本人，用占位值 `'self'` 映射为空串，避免 Radix Select 空值问题。
2. **编辑态绑定归属**：`toForm` 回填 `key.userId`，若成员已不在列表（被移除）则下拉显示占位，不影响其他字段编辑。

## 4. 验证结果

- `pnpm --filter portal-frontend lint`：0 errors（4 处既有 warning 与本需求无关）。
- `pnpm --filter portal-frontend build`：通过。

## 5. 关联

- feature：`docs/feature/api_key.md`
- 后端：`docs/development/API_KEY_REQ-003_DEVELOPMENT.md`
