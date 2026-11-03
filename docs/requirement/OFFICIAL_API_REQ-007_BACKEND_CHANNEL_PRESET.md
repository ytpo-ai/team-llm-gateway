# OFFICIAL_API_REQ-007 后端：官方预置目录扩展 + Provider.presetKey + 一键开启端点

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/model_provider.md` |
| 所属 plan | `docs/plan/OFFICIAL_CHANNEL_PRESET_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/official-channel-preset` |
| 状态 | `in-progress` |

## 2. 需求描述

### 背景
官方预置目录仅 3 家（OpenAI/Anthropic/Gemini），渠道管理页无「一键开启官方直连」入口。现扩展预置目录并落地后端一键开启能力。

### 目标
- `OfficialProviderPreset` 增加唯一 `key`；静态目录扩展国内外主流 LLM（DeepSeek / Moonshot-Kimi / 通义千问 Qwen / 智谱 GLM / MiniMax / 豆包 Doubao / xAI Grok / Mistral 等），含 baseUrl + 官方模型清单（能力标签/倍率，对齐 `capabilities` 字典）。
- `Provider` 增加可选 `presetKey` 字段（schema + DTO + view），标记来源官方预置；手动渠道为 `null`；同一 `presetKey` 允许多条。
- 新增 `POST /providers/from-preset`：入参 `{ presetKey, apiKey, name? }` → 查预置（复用 `getOfficialPresets`）→ 预填 name/type/authType/baseUrl 创建渠道（复用 create + 加密 + 审计）→ 自动批量导入官方模型（复用 `bulkCreate`）→ 返回 `{ provider, models }`。

### 验收条件
- [ ] `GET /models/presets` 返回的预置含国内外主流且带 `key`。
- [ ] `Provider` 列表返回 `presetKey`（无则 null）。
- [ ] `POST /providers/from-preset` 正确建渠道并导入模型；预置不存在返回 404；渠道名称冲突返回 409。
- [ ] RBAC：仅 `team_admin`。
- [ ] `pnpm --filter portal-backend lint`/`typecheck`/`test` 通过。

## 3. 技术方案摘要
- 预置目录与一键开启方案见 `docs/plan/OFFICIAL_CHANNEL_PRESET_PLAN.md` §3。
- `ProvidersModule` 引入 `ModelsModule`，`ProvidersService` 注入 `ModelsService` 复用 `getOfficialPresets` 与 `bulkCreate`。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/OFFICIAL_API_REQ-007_DEVELOPMENT.md`（待补充） |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [ ] 待验收
- [ ] 已交付
