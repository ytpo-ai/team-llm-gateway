# 官方渠道双格式 + 统一添加入口开发计划（OFFICIAL_CHANNEL_DUAL_FORMAT）

> 官方渠道只是「渠道创建」的一个快捷方式：由系统预置 label/URL/协议类型并自动导入官方模型，创建后即为普通渠道，与手动创建的渠道完全一致、可编辑全部字段。
>
> - 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-13、§5.2）
> - 上游 plan：`docs/plan/OFFICIAL_CHANNEL_PRESET_PLAN.md`（本 plan 在其基础上演进）
> - 定稿时间：2026-11-04
> - 状态：`done`

---

## 1. 需求背景

1. 官方预置目录中每家官方只有单一 `type` + 单一 `baseUrl`，无法表达「同一官方同时提供 OpenAI 格式 / Anthropic 格式两种官方端点」的现状（如 DeepSeek：OpenAI `https://api.deepseek.com`、Anthropic `https://api.deepseek.com/anthropic`）。
2. DeepSeek 预置的 OpenAI baseUrl 写死为 `https://api.deepseek.com/v1`，与官方文档不一致；模型仍为已下线的 `deepseek-chat` / `deepseek-reasoner`，需更新为 `deepseek-flash` / `deepseek-v4-pro`。
3. 渠道管理页「官方直连」与「添加上游渠道」是两个独立入口，交互割裂；官方渠道开启时无法选择格式、无法修改 URL。
4. 官方渠道（`presetKey` 标记）在编辑表单中未暴露「是否官方渠道」字段。

## 2. 目标

1. 官方预置数据结构由单一 `type/baseUrl` 升级为 `formats: [{ type, baseUrl }]`，支持一家官方多种接入格式。
2. 修正并刷新官方预置：DeepSeek 提供 OpenAI + Anthropic 双格式并更新模型；其余官方按实际支持补充格式。
3. 官方渠道走「统一添加入口」：页面仅一个「添加渠道」按钮，弹层内第一项为「自定义渠道」卡片，后续为「官方渠道」列表；官方渠道开启时可选择格式、可修改 URL。
4. 渠道编辑表单补齐「是否官方渠道」（`presetKey`）字段，使官方渠道与普通渠道编辑能力完全对齐。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 预置数据模型 | `OfficialProviderPreset` 增加 `formats: OfficialFormatPreset[]`（`{ type, baseUrl }`），替换原单一 `type`/`baseUrl`；`models` 不变 |
| 预置目录刷新 | DeepSeek `formats = [openai-compatible@https://api.deepseek.com, anthropic@https://api.deepseek.com/anthropic]`，模型更新为 `deepseek-flash` / `deepseek-v4-pro`；Anthropic / Gemini 补 OpenAI 兼容格式；其余保持单格式 |
| 一键开启 | `POST /providers/from-preset` 入参增加 `format`（`ProviderType`）与 `baseUrl`（URL 覆盖）：`format` 选定 `type` 与默认 `baseUrl`，传 `baseUrl` 则覆盖 URL（`type` 仍由 `format` 决定），`format` 缺省取 `formats[0]` |
| 统一添加入口 | 移除页面独立「官方直连」卡片区，改为单个「添加渠道」按钮 → 弹层（自定义渠道卡片 + 官方渠道列表）；开启弹窗含「格式选择 + 可编辑 URL」 |
| 编辑对齐 | 编辑表单新增「是否官方渠道」（`presetKey` 下拉），后端 `update` 已支持 `presetKey` |
| RBAC | 与 providers/models 写操作一致，`team_admin` |

## 4. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [OFFICIAL_API_REQ-009](../requirement/OFFICIAL_API_REQ-009_BACKEND_DUAL_FORMAT.md) | 后端：预置 `formats` 模型 + DeepSeek 等目录刷新 + `from-preset` 支持 `format`/`baseUrl` | 预置返回 `formats`；`from-preset` 按 `format` 建对应 `type`/`baseUrl`、`baseUrl` 覆盖生效、缺省取首格式；lint/typecheck/test 通过 |
| [OFFICIAL_API_REQ-010](../requirement/OFFICIAL_API_REQ-010_FRONTEND_UNIFIED_ADD.md) | 前端：统一添加入口 + 官方列表 + 开启弹窗（格式+URL）+ 编辑表单 `presetKey` + 模型页导入选择器按 key | 页面仅一个添加按钮；官方开启可选格式、可改 URL；编辑可改「是否官方」；模型页导入选择器按 key；lint/typecheck/build 通过 |

## 5. 里程碑

1. ✅ REQ-009 后端：预置 `formats` + 目录刷新 + `from-preset` 扩展。
2. ✅ REQ-010 前端：统一添加入口 + 开启弹窗 + 编辑表单 `presetKey` + 模型页选择器调整。

## 6. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| C-01 | Anthropic / Gemini 的 OpenAI 兼容端点 URL 需实测探活核对 | 先「跑通再优化」，URL 以官方文档为准 |
| C-02 | 同一模型仍只绑定一条渠道（`modelId` 团队内唯一）；开启双格式会建两条渠道，模型目录中同 `modelId` 只归属先开的那条 | 符合「选一种格式接入」，不做多上游路由（留 Phase 2） |

## 7. 关联

- 上游：`OFFICIAL_CHANNEL_PRESET_PLAN.md`、`MODEL_PROVIDER_PLAN.md`
- feature：`docs/feature/model_provider.md`
- requirement：见 §4
