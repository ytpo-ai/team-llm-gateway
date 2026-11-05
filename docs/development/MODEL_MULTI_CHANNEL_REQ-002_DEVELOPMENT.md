# MODEL_MULTI_CHANNEL_REQ-002 开发记录（前端渠道展示与优先级管理）

> 对应需求：`docs/requirement/MODEL_MULTI_CHANNEL_REQ-002_FRONTEND.md`
> 对应计划：`docs/plan/MODEL_MULTI_CHANNEL_PLAN.md`
> 分支：`main`

## 1. 实现摘要

在模型目录页新增渠道标签列展示模型绑定的所有渠道及优先级，编辑表单支持多渠道选择与数字优先级输入。

- 类型层：`ProviderBindingView`（含 `providerId/providerName/priority`）、`ProviderBindingInput`（`providerId/priority`）。`Model` 新增 `providerBindings`，`ModelInput/ModelPatch` 新增 `providerBindings` 可选字段。
- 列表页：新增「渠道」列，按优先级升序展示绑定渠道 tag 标签（含 `[P0]` 优先级标注），主渠道（`providerId`）使用 primary 色高亮，其余用 muted 色。
- 编辑表单：主渠道 Select 不变；新增「额外渠道绑定」区域，支持动态增删行（每行：渠道 Select + 优先级 Input + 移除按钮）；渠道 Select 自动排除已选渠道避免重复。
- `toForm`：编辑时将 model 的 `providerBindings` 中非主渠道项转为表单 `bindings` 数组。
- 向后兼容：`providerBindings` 为空时列表显示 `—`，表单无额外绑定行。

## 2. 代码改动点

### 修改

| 文件 | 说明 |
|---|---|
| `features/models/types.ts` | 新增 `ProviderBindingView`、`ProviderBindingInput`；`Model/ModelInput/ModelPatch` 增加 `providerBindings` |
| `pages/models.tsx` | 列表新增「渠道」列（tag 标签 + 优先级标注）；编辑表单新增额外渠道绑定区域（动态增删行）；`toForm` 适配 bindings；`buildProviderBindings` 提交时组装数据 |

## 3. 踩坑记录

1. **渠道互斥选择**：额外渠道 Select 需要排除已选的主渠道和其他额外渠道，否则会出现重复绑定。实现用 `availableProviders(bindingIndex)` 根据当前表单状态计算可用 provider 列表。
2. **主渠道标识**：表格中通过 `b.providerId === model.providerId` 判定主渠道并高亮，需注意后端 `providerBindings` 返回的是 `ProviderBindingView`（含 resolved `providerName`），而非原始 ObjectId。
3. **TypeScript 严格模式**：`toForm` 中定义但未使用的 `primaryBinding` 变量导致编译失败（`TS6133`），移除以通过 `tsc -b`。
4. **表单 priority 类型**：表单以 string 存储 priority（与 Input 的 value 一致），提交时 `Number(b.priority) || 0` 转换为数字。

## 4. 验证结果

- `pnpm --filter portal-frontend lint`：仅 2 条既有 warning（`theme-provider.tsx`、`button.tsx`）。
- `pnpm --filter portal-frontend typecheck`：通过。
- `pnpm --filter portal-frontend build`：通过（vite 构建成功，639.51 kB gzip 187.63 kB）。

## 5. 关联

- feature：`docs/feature/model_provider.md`
- 上游 plan：`docs/plan/MODEL_PROVIDER_PLAN.md`
- 后端 req：`docs/requirement/MODEL_MULTI_CHANNEL_REQ-001_BACKEND.md`