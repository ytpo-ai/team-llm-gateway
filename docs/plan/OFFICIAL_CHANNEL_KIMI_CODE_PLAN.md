# 官方渠道新增 Kimi Code（OFFICIAL_CHANNEL_KIMI_CODE）

> 在「上游渠道 → 添加渠道 → 官方渠道」列表中新增「Kimi Code」预置，与现有「Moonshot Kimi」并列，填 Key 即可直连 Kimi Code 官方编码平台并自动导入官方编码模型。
>
> - 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-13、§5.2）
> - 上游 plan：`docs/plan/OFFICIAL_CHANNEL_DUAL_FORMAT_PLAN.md`（预置数据结构沿用其 `formats` 模型）
> - 定稿时间：2026-11-05
> - 状态：`done`

---

## 1. 需求背景

1. 官方渠道预置目录已有 11 家主流 LLM，其中 Moonshot 相关仅有「Moonshot Kimi」（`api.moonshot.cn/v1`，通用 Kimi 对话模型）。
2. Moonshot AI 另推出了独立编码平台 **Kimi Code**，提供 OpenAI 兼容编码端点与专属编码模型（`k3` / `kimi-for-coding` / `kimi-for-coding-highspeed`），与通用 Kimi API 是两套端点、两套模型。
3. 团队接入 Kimi Code 时只能走「自定义渠道」手动填写，无法从官方渠道快捷开启并自动导入官方模型。

## 2. 目标

1. 官方预置目录新增「Kimi Code」：OpenAI 兼容端点 `https://api.kimi.com/coding/v1`（国内），模型清单 `k3` / `kimi-for-coding` / `kimi-for-coding-highspeed`（含能力标签与默认倍率）。
2. 前端「添加渠道」弹窗自动出现「Kimi Code」卡片，可一键开启并自动导入官方模型（复用现有 `from-preset` 链路，前端零改动）。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 预置数据 | 在 `official-presets.ts` 的 `OFFICIAL_PRESETS` 中、`moonshot` 之后新增一项，复用 `formats` + `models` 结构 |
| 接入端点 | OpenAI 兼容：`https://api.kimi.com/coding/v1`（国内；海外为 `https://api.kimi.ai/coding/v1`） |
| 模型清单 | `k3`（旗舰，1M 上下文）、`kimi-for-coding`（均衡，256K）、`kimi-for-coding-highspeed`（高速，256K） |
| 能力标签 | 对齐 `capabilities` 字典：`chat` / `code` / `reasoning` / `vision` / `long-context` |
| 倍率 | 占位估算（无官方精确报价，后续可按实调整）：`k3=1`、`kimi-for-coding=0.5`、`highspeed=0.8` |
| 前端 | 零改动：`providers.tsx` 动态渲染 `GET /models/presets` 下发的预置列表 |

## 4. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [OFFICIAL_API_REQ-011](../requirement/OFFICIAL_API_REQ-011_BACKEND_KIMI_CODE_PRESET.md) | 后端：官方预置目录新增 Kimi Code（端点 + 模型清单） | `GET /models/presets` 返回含 `kimi-code`；一键开启可建渠道并导入 3 个模型；lint/typecheck/test 通过 |

## 5. 里程碑

1. ✅ REQ-011 后端：官方预置目录新增 Kimi Code 项。

## 6. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| C-01 | `formats` 按协议类型去重，无法同时表达国内/海外两个同协议端点；默认取国内 `api.kimi.com`，海外团队可手动改 URL | 已确认默认国内端点，URL 可编辑 |
| C-02 | 模型倍率为占位估算（无官方精确报价），后续按实调整 | 占位，可调 |
| C-03 | Kimi Code 另有 Anthropic 兼容端点（`https://api.kimi.com/coding/`），本期仅接 OpenAI 兼容，Anthropic 格式留后续 | 仅接 OpenAI 兼容 |

## 7. 关联

- 上游：`OFFICIAL_CHANNEL_DUAL_FORMAT_PLAN.md`、`OFFICIAL_CHANNEL_PRESET_PLAN.md`
- feature：`docs/feature/model_provider.md`
- requirement：见 §4
