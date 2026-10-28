# MODEL_PROVIDER_REQ-002 开发记录（前端模型与上游管理）

> 对应需求：`docs/requirement/MODEL_PROVIDER_REQ-002_FRONTEND_PROVIDER_MODEL.md`
> 对应计划：`docs/plan/MODEL_PROVIDER_PLAN.md`
> 分支：`main`

## 1. 实现摘要

落地「模型与上游」前端：上游渠道管理页与模型目录页，接入路由与导航，RBAC 前端表现（渠道管理仅 `team_admin` 可见）。

- `features/providers/`（types、api）：`Provider` 类型与 `listProviders`/`createProvider`/`updateProvider`/`removeProvider`。
- `features/models/`（types、api）：`Model` 类型与 `listModels`/`createModel`/`updateModel`/`removeModel`。
- `pages/providers.tsx`：列表（名称/类型/baseUrl/脱敏 key/状态）+ 创建/编辑表单（名称/协议类型下拉/baseUrl/上游 key，编辑留空 key 表示不修改）+ 删除（软禁用）；非 `team_admin` 显示无权限提示。
- `pages/models.tsx`：列表（模型标识/展示名/倍率/能力标签/状态）+ 创建/编辑表单（渠道下拉/模型标识/展示名/倍率/能力标签/别名，逗号分隔）+ 删除；写操作仅 `team_admin`，读所有成员。
- 路由 `/providers`、`/models` 接入 `router.tsx`；导航「模型」对所有成员、导航「上游」仅 `team_admin` 可见（`app-layout.tsx`）。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `features/providers/types.ts` | `Provider`/`ProviderInput`/`ProviderPatch` + 类型标签 |
| `features/providers/api.ts` | providers 接口封装 |
| `features/models/types.ts` | `Model`/`ModelInput`/`ModelPatch` |
| `features/models/api.ts` | models 接口封装 |
| `pages/providers.tsx` | 上游渠道管理页 |
| `pages/models.tsx` | 模型目录页 |

### 修改

| 文件 | 说明 |
|---|---|
| `router.tsx` | 新增 `/providers`、`/models` 路由 |
| `components/layout/app-layout.tsx` | 导航新增「模型」「上游」（上游仅 admin） |

## 3. 踩坑记录

- **前端不依赖 Select 组件**：现有 UI 库仅 button/card/input，渠道类型与归属渠道下拉用原生 `<select>` + 复用 team 页的 `selectClass` 样式，保持视觉一致。
- **上游 key 不回显**：编辑时 `apiKey` 输入框留空，提交仅当非空时才写入 patch，避免把脱敏值误当明文回传。

## 4. 验证结果

- `pnpm --filter portal-frontend typecheck`：通过。
- `pnpm --filter portal-frontend lint`：0 errors（1 个既有 warning 与本次无关）。
- `pnpm --filter portal-frontend build`：通过。

## 5. 关联

- feature：`docs/feature/model_provider.md`
- 数据契约：`docs/technical/db_schema/MODEL_PROVIDER_SCHEMA.MD` §5
