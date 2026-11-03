# OFFICIAL_API_REQ-007 开发记录（后端：官方预置扩展 + Provider.presetKey + 一键开启）

> 对应需求：`docs/requirement/OFFICIAL_API_REQ-007_BACKEND_CHANNEL_PRESET.md`
> 对应计划：`docs/plan/OFFICIAL_CHANNEL_PRESET_PLAN.md`
> 分支：`main`

## 1. 实现摘要

落地「渠道管理内置主流 LLM 官方直连」的后端能力。

- 官方预置目录从 3 家扩展到 11 家国内外主流（OpenAI/Anthropic/Gemini/DeepSeek/Moonshot-Kimi/通义千问 Qwen/智谱 GLM/MiniMax/豆包 Doubao/xAI Grok/Mistral），`OfficialProviderPreset` 增加唯一 `key`（复用 `GET /models/presets` 下发，远程拉取 + 缓存 + 静态回退不变）。
- `Provider` 增加可选 `presetKey` 字段（schema + DTO + view），标记来源官方预置；手动渠道不写该字段；同一 `presetKey` 允许存在多条（不同名称/不同 key），无唯一约束。
- 新增 `POST /providers/from-preset`：入参 `{ presetKey, apiKey, name? }` → 查预置 → 预填 name/type/authType/baseUrl 建渠道（复用 `create`，含 AES-256-GCM 加密 + 审计）→ 自动批量导入该官方模型（复用 `bulkCreate`）→ 返回 `{ provider, models }`。

## 2. 代码改动点

### 后端

| 文件 | 说明 |
|---|---|
| `modules/models/official-presets.ts` | `OfficialProviderPreset` 增加 `key`；预置目录扩展至 11 家 |
| `modules/providers/schemas/provider.schema.ts` | 新增可选 `presetKey` 字段 |
| `modules/providers/dto/create-provider.dto.ts` | 新增可选 `presetKey` |
| `modules/providers/dto/update-provider.dto.ts` | 新增可选 `presetKey` |
| `modules/providers/dto/create-provider-from-preset.dto.ts` | 新增一键开启入参（presetKey/apiKey/name?） |
| `modules/providers/providers.service.ts` | `ProviderView` 增加 `presetKey`；`create`/`update` 透传；新增 `createFromPreset()`；注入 `ModelsService` |
| `modules/providers/providers.controller.ts` | 新增 `POST /providers/from-preset`（含审计） |
| `modules/providers/providers.module.ts` | 引入 `ModelsModule` |
| `modules/providers/providers.service.spec.ts` | 新增 `createFromPreset` 单测（3 例） |

## 3. 踩坑记录

1. Mongoose 文档类型为 `presetKey?: string`，不支持 `null`：落库时用 `undefined`（缺省）而非 `null`；仅在 `ProviderView`（对外）统一归一为 `null`，避免 `TS2769`/`TS2322`。
2. 模块依赖单向：`ProvidersModule → ModelsModule`，`ModelsModule` 不依赖 `ProvidersModule`（仅 `MongooseModule.forFeature` 注册 `Provider` schema），无循环依赖。
3. `from-preset` 非强事务：先建渠道再导模型，模型导入失败时渠道已建，前端提示可重试（模型目录「官方预设导入」可补）。

## 4. 验证结果

- 后端：lint 0/0、typecheck 通过、test 137 passed（`providers.service.spec.ts` 13 例含新增 3 例）。

## 5. 关联

- feature：`docs/feature/model_provider.md`
- 计划：`docs/plan/OFFICIAL_CHANNEL_PRESET_PLAN.md`
