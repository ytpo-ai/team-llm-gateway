# OFFICIAL_API_REQ-004 开发记录（前端类型选择 + 官方预置目录 + 探活）

> 对应需求：`docs/requirement/OFFICIAL_API_REQ-004_FRONTEND_PRESET_PROBE.md`
> 对应计划：`docs/plan/OFFICIAL_API_PRESET_PLAN.md`
> 分支：`main`

## 1. 实现摘要

补齐「官方 API 接入」的前端交互与配套后端接口，闭环 `MODEL_PROVIDER_PLAN` M-03。

- 后端连通性探活 `POST /providers/:id/test`：解密 key → 按 `type` 用适配器发最小探测请求（`max_tokens:1`）→ 返回 `{ ok, latencyMs, message }`；401/403 判定鉴权失败，不落库、不计量。
- 后端批量导入 `POST /models/bulk`：`providerId` + `models[]`，校验渠道归属，已存在则跳过。
- 前端 provider 表单支持三类协议类型（`openai-compatible`/`anthropic`/`gemini`），Base URL 占位按类型提示；渠道列表新增「测试」按钮展示连通结果与延迟。
- 前端官方预置目录（`features/models/presets.ts` 静态常量，OpenAI/Anthropic/Gemini 三组），模型页「官方预设导入」面板：选协议类型 → 选目标渠道 → 勾选模型 → 批量导入。

## 2. 代码改动点

### 后端

| 文件 | 说明 |
|---|---|
| `modules/providers/providers.service.ts` | 新增 `test()` 探活 |
| `modules/providers/providers.controller.ts` | 新增 `POST /providers/:id/test` |
| `modules/providers/providers.service.spec.ts` | 新增探活单测（3 例） |
| `modules/models/dto/bulk-create-model.dto.ts` | 批量导入入参 |
| `modules/models/models.service.ts` | 新增 `bulkCreate()`（跳过已存在） |
| `modules/models/models.controller.ts` | 新增 `POST /models/bulk` |
| `modules/models/models.service.spec.ts` | 新增 bulkCreate 单测（2 例） |

### 前端

| 文件 | 说明 |
|---|---|
| `features/providers/types.ts` | `ProviderType` 增加 `gemini` + 标签 + Base URL 占位提示 + `ProviderProbeResult` |
| `features/providers/api.ts` | 新增 `testProvider()` |
| `pages/providers.tsx` | 类型联动 Base URL 占位 + 「测试」按钮与结果展示 |
| `features/models/presets.ts` | 官方预置目录静态常量 |
| `features/models/api.ts` | 新增 `bulkCreateModels()` |
| `pages/models.tsx` | 「官方预设导入」面板 |

## 3. 踩坑记录

1. Nest 路由顺序：`POST /models/bulk` 与 `POST /models` 需区分路径，`@Post('bulk')` 放在 `@Post()` 之后即可正常匹配，无 `:id` 冲突。

## 4. 验证结果

- 后端：lint 0/0、typecheck 通过、build 通过、test 112 passed。
- 前端：lint 3 警告（均 `team.tsx`/`theme-provider.tsx` 既有）、typecheck 通过、build 通过。

## 5. 关联

- feature：`docs/feature/model_provider.md`
- 计划：`docs/plan/OFFICIAL_API_PRESET_PLAN.md`
