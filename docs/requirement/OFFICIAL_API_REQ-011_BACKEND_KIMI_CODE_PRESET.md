# OFFICIAL_API_REQ-011 后端：官方预置目录新增 Kimi Code

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/model_provider.md` |
| 所属 plan | `docs/plan/OFFICIAL_CHANNEL_KIMI_CODE_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `main` |
| 状态 | `done` |

## 2. 需求描述

### 背景
官方渠道预置目录中 Moonshot 相关仅有「Moonshot Kimi」（通用 Kimi 对话模型），缺少 Moonshot AI 独立编码平台「Kimi Code」（OpenAI 兼容编码端点 + 专属编码模型）。团队需手动建自定义渠道才能接入。

### 目标
- `OFFICIAL_PRESETS` 新增 `kimi-code` 项：`formats = [openai-compatible@https://api.kimi.com/coding/v1]`，模型清单 `k3` / `kimi-for-coding` / `kimi-for-coding-highspeed`（能力标签对齐 `capabilities` 字典，倍率占位）。
- 前端「添加渠道」弹窗自动展示「Kimi Code」卡片，复用现有 `POST /providers/from-preset` 一键开启并导入官方模型（前端零改动）。

### 验收条件
- [x] `GET /models/presets` 返回的预置含 `key: 'kimi-code'`、label `Kimi Code`、正确 `formats` 与 3 个模型。
- [x] 一键开启 Kimi Code 可建渠道（`openai-compatible`，`baseUrl=https://api.kimi.com/coding/v1`）并导入 3 个官方模型。
- [x] `pnpm --filter portal-backend lint`/`typecheck`/`test` 通过。

## 3. 技术方案摘要

- 复用现有预置数据结构（`formats` + `models`），仅在 `official-presets.ts` 的 `OFFICIAL_PRESETS` 数组中、`moonshot` 项之后新增 `kimi-code` 项。
- 端点/模型来源：Kimi Code 官方文档（www.kimi.com/code/docs），OpenAI 兼容国内端点 `https://api.kimi.com/coding/v1`，模型 `k3`（1M 上下文）、`kimi-for-coding`（256K）、`kimi-for-coding-highspeed`（256K）。
- 前端 `providers.tsx` 已动态渲染 `officialPresets`，无需改动。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/OFFICIAL_API_REQ-011_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
