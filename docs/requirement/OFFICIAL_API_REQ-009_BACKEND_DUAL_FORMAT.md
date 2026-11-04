# OFFICIAL_API_REQ-009 后端：官方预置 formats 模型 + 目录刷新 + from-preset 双格式

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/model_provider.md` |
| 所属 plan | `docs/plan/OFFICIAL_CHANNEL_DUAL_FORMAT_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/official-channel-dual-format` |
| 状态 | `done` |

## 2. 需求描述

### 背景
官方预置目录每家官方只有单一 `type` + `baseUrl`，无法表达「同一官方提供 OpenAI / Anthropic 两种格式」；DeepSeek 预置 URL 与模型名已过期。

### 目标
- `OfficialProviderPreset` 由 `{ type, baseUrl }` 升级为 `{ formats: [{ type, baseUrl }] }`（新增 `OfficialFormatPreset`）。
- 刷新 `OFFICIAL_PRESETS`：
  - DeepSeek：`formats = [{ openai-compatible, https://api.deepseek.com }, { anthropic, https://api.deepseek.com/anthropic }]`；模型更新为 `deepseek-flash` / `deepseek-v4-pro`。
  - Anthropic / Gemini 补 OpenAI 兼容格式；其余官方保持单格式（包一层 `formats`）。
- `CreateProviderFromPresetDto` 增加 `format?: ProviderType` 与 `baseUrl?: string`；`createFromPreset` 解析：`format` 选定 `type` 与默认 `baseUrl`，传 `baseUrl` 覆盖 URL，`format` 缺省取 `formats[0]`。

### 验收条件
- [ ] `GET /models/presets` 返回的预置含 `formats`（数组，每项 `type` + `baseUrl`）。
- [ ] `POST /providers/from-preset`：不传 `format` 建 `formats[0]` 对应渠道；传 `format` 建对应 `type`/`baseUrl` 渠道；传 `baseUrl` 覆盖 URL 而 `type` 不变。
- [ ] 预置不存在返回 404。
- [ ] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过。

## 3. 技术方案摘要

- 预置模型与刷新见 `docs/plan/OFFICIAL_CHANNEL_DUAL_FORMAT_PLAN.md` §3。
- `createFromPreset` 在 `providers.service.ts` 中按 `preset.formats.find(f => f.type === dto.format) ?? preset.formats[0]` 解析格式。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/OFFICIAL_API_REQ-009_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
