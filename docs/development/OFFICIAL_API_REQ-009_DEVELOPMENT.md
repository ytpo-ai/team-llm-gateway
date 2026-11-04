# OFFICIAL_API_REQ-009 开发记录（后端：官方预置 formats 模型 + from-preset 双格式）

> 对应需求：`docs/requirement/OFFICIAL_API_REQ-009_BACKEND_DUAL_FORMAT.md`
> 对应计划：`docs/plan/OFFICIAL_CHANNEL_DUAL_FORMAT_PLAN.md`
> 分支：`feat/official-channel-dual-format`

## 1. 实现摘要

官方渠道只是「渠道创建」的快捷方式：系统预填 label/URL/协议并自动导入官方模型。本期把官方预置从「单一协议」升级为「多格式」，支持同一官方提供 OpenAI / Anthropic 等多种接入端点。

- `OfficialProviderPreset` 由 `{ type, baseUrl }` 升级为 `{ formats: [{ type, baseUrl }] }`（新增 `OfficialFormatPreset`），`models` 不变。
- 刷新预置目录：DeepSeek 提供 OpenAI（`https://api.deepseek.com`）+ Anthropic（`https://api.deepseek.com/anthropic`）双格式，模型更新为 `deepseek-flash` / `deepseek-v4-pro`（替换已下线的 `deepseek-chat`/`deepseek-reasoner`）；Anthropic、Gemini 补 OpenAI 兼容格式；其余保持单格式。
- `POST /providers/from-preset` 入参增加 `format`（`ProviderType`）与 `baseUrl`（URL 覆盖）：`format` 选定 `type` 与默认 `baseUrl`，传 `baseUrl` 覆盖 URL（`type` 仍由 `format` 决定），`format` 缺省取 `formats[0]`。

## 2. 代码改动点

### 后端

| 文件 | 说明 |
|---|---|
| `modules/models/official-presets.ts` | `OfficialProviderPreset` 增 `formats`（新增 `OfficialFormatPreset`）；DeepSeek 双格式 + 模型更新；Anthropic/Gemini 补 OpenAI 兼容格式 |
| `modules/providers/dto/create-provider-from-preset.dto.ts` | 新增 `format?`（`@IsEnum(ProviderType)`）与 `baseUrl?`（`@IsUrl`） |
| `modules/providers/providers.service.ts` | `createFromPreset` 解析 `format`（`formats.find(...) ?? formats[0]`）与 `baseUrl` 覆盖 |
| `modules/providers/providers.service.spec.ts` | preset fixture 改 `formats`；新增「选格式」「URL 覆盖」用例 |
| `modules/models/models.service.spec.ts` | 断言 `formats`；远程 catalog fixture 改新 shape |

## 3. 踩坑记录

1. 格式解析兜底：`preset.formats.find(f => f.type === dto.format) ?? preset.formats[0]`；`formats` 为空时抛 `NotFoundException`（防御性，正常预置不会出现）。
2. `baseUrl` 覆盖只改 URL、`type` 仍由 `format` 决定——保持「格式 = 协议类型」的语义，避免 URL 与协议不一致。
3. 同一模型仍只绑定一条渠道（`modelId` 团队内唯一）：开启双格式会建两条渠道，但模型目录中同 `modelId` 只归属先开的那条；符合「选一种格式接入」，多上游路由留 Phase 2（plan C-02）。

## 4. 验证结果

- 后端：typecheck 通过、lint 0/0、test 171 passed（含 `createFromPreset` 新增 2 例）。

## 5. 关联

- feature：`docs/feature/model_provider.md`
- 计划：`docs/plan/OFFICIAL_CHANNEL_DUAL_FORMAT_PLAN.md`
