# 修复：禁用上游渠道未级联禁用模型，转发层误报「上游渠道不存在或已禁用」

> 关联 feature：`docs/feature/model_provider.md`、`docs/feature/usage_metering.md`
> 关联 requirement：`docs/requirement/USAGE_METERING_REQ-002_BACKEND_PROXY.md`（转发层）、`MODEL_PROVIDER_REQ-001_BACKEND_PROVIDER_MODEL.md`（渠道/模型）
> 修复日期：2026-11-04

## 1. 问题现象

团队添加两个 DeepSeek 官方渠道「DeepSeek官方」（后被禁用）与「DeepSeek官方1」（启用），`deepseek-v4-pro` 模型绑定在启用的「DeepSeek官方1」上。通过 opencode 经 gateway 选择 `deepseek-v4-pro` 对话时，返回 `上游渠道不存在或已禁用`。

## 2. 根因分析

1. **错误来源**：`apps/portal-backend/src/modules/proxy/proxy.service.ts` `prepare()`（第 205–216 行）。模型解析成功后，按 `{ _id: model.providerId, tenantId, teamId, status: active }` 查询渠道，查不到即抛 `上游渠道不存在或已禁用`。

2. **真正的隐患（僵尸模型）**：禁用渠道（`providers.service.remove()`）时**只把渠道软禁用，没有级联禁用它下面的模型**。于是会出现「模型 status 仍为 active、但绑定的渠道已 disabled」的僵尸模型：

   - `listModels()`（`/v1/models`）只按模型自身 `status: active` 过滤，不看渠道状态 → 僵尸模型仍被 opencode 列出；
   - 模型管理页仍显示「正常」；
   - 但一请求就命中上面的 provider 查询失败 → 报 `上游渠道不存在或已禁用`。

3. **本次数据核实**（数据库 + 审计日志）：
   - `deepseek-v4-pro` 自 09:15 创建起一直绑定在启用的「DeepSeek官方1」上，未绑定到被禁用的渠道；
   - 实测（真实请求 `POST /v1/chat/completions` model=deepseek-v4-pro）返回 200 且拿到 DeepSeek 真实回复 —— 即**当前 deepseek-v4-pro 链路已通**；
   - 用户遇到的报错来自中间状态：`deepseek-chat`/`deepseek-reasoner` 在 09:22 禁用渠道后到 09:54 手动禁用模型前，一直是「active 模型 + disabled 渠道」的僵尸状态（或 opencode 缓存了旧模型列表选中了僵尸模型）。

## 3. 修复动作

### 后端（`apps/portal-backend/src/modules/`）

- `models/models.service.ts`：新增 `disableByProvider(tenantId, teamId, providerId)`，`updateMany` 将指定渠道下 `status: active` 的模型批量置为 `disabled`，返回 `modifiedCount`。
- `providers/providers.service.ts`：`remove()` 软禁用渠道后，调用 `modelsService.disableByProvider(...)` 级联禁用其下模型。
- `proxy/proxy.service.ts`：`listModels()` 先查当前团队 `active` 渠道 id 集合，模型查询追加 `providerId: { $in: activeProviderIds }`，不再把「渠道已禁用」的僵尸模型暴露给 opencode。

### 测试

- `models.service.spec.ts`：新增 `disableByProvider` 用例（断言 filter/update 与返回值）。
- `providers.service.spec.ts`：`remove` 用例补充「级联禁用模型」断言；`modelsService` mock 增 `disableByProvider`。
- `proxy.service.spec.ts`：`providerModel` mock 增 `find`；新增「listModels 排除渠道已禁用模型」用例（断言 model 查询带 `providerId $in` 过滤）。

## 4. 验证结果

- `pnpm --filter portal-backend test`：24 文件 / 184 用例通过。
- `pnpm --filter portal-backend typecheck`、`lint`：通过。

## 5. 关联

- feature：`docs/feature/model_provider.md`、`docs/feature/usage_metering.md`（需求追溯表已更新）
- 代码：`models/models.service.ts`、`providers/providers.service.ts`、`proxy/proxy.service.ts`
