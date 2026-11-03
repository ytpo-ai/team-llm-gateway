# 渠道管理内置主流 LLM 官方直连（一键开启）开发计划（OFFICIAL_CHANNEL_PRESET）

> 本 plan 在「渠道管理（providers）」页内置主流 LLM 官方直连预置卡片：默认未开启，用户填 Key 即可一键开启官方直连渠道并自动导入官方模型。
>
> - 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-13、§5.2）
> - 上游 plan：`docs/plan/OFFICIAL_API_PRESET_PLAN.md`（预置目录 + 探活，本 plan 复用其预置目录）
> - 定稿时间：2026-11-03
> - 状态：`done`

---

## 1. 需求背景

「模型目录」页已支持从官方预置目录一键导入模型，但「渠道管理」页仍是纯手动表单：团队需自行填写渠道名称、协议类型、Base URL，再回到模型目录手动逐条导入官方模型。现把「官方直连」下沉到渠道管理页：内置主流 LLM 官方直连预置卡片，默认「未开启」，用户点「开启使用」填 Key 即一键创建官方直连渠道并自动导入其官方模型，真正开箱即用。

## 2. 目标

1. 官方预置目录从 3 家扩展到国内外主流 LLM（OpenAI / Anthropic / Gemini / DeepSeek / Moonshot-Kimi / 通义千问 Qwen / 智谱 GLM / MiniMax / 豆包 Doubao / xAI Grok / Mistral 等），并为每个预置赋予唯一 `key`。
2. `Provider` 增加可选 `presetKey` 字段，标记渠道来源官方预置；同一官方可开启多个渠道（不同名称 / 不同 Key），不设唯一约束。
3. 新增「一键开启」端点 `POST /providers/from-preset`：按 `presetKey` 预填名称/类型/Base URL 创建渠道，并自动批量导入该官方模型到模型目录。
4. 渠道管理页新增「官方直连」卡片区：逐家展示预置卡片，按 `presetKey` 关联已有渠道显示「未开启 / 已开启 N 个」，提供「开启使用 / 再添加一个」弹窗。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 预置目录 | 复用 `GET /models/presets`（`ModelsService.getOfficialPresets`，远程拉取 + 缓存 + 静态回退）；`OfficialProviderPreset` 增加 `key`；静态目录扩展国内外主流 |
| 渠道来源标记 | `Provider.presetKey`（可选字符串），手动创建的自定义渠道为 `null`；同一 `presetKey` 允许多条 |
| 一键开启 | 后端 `POST /providers/from-preset`（入参 `presetKey` + `apiKey` + 可选 `name`）：查预置 → 复用 `ProvidersService.create` 建渠道（含加密 + 审计）→ 复用 `ModelsService.bulkCreate` 导入官方模型 → 返回 `{ provider, models }` |
| 非强事务 | 先建渠道再导模型；模型导入失败时渠道已建，前端提示可重试导入（模型目录「官方预设导入」可补） |
| RBAC | `from-preset` 与 providers/models 写操作一致，`team_admin` |
| 前端 | `features/providers/` 增加官方直连卡片区 + 开启弹窗；`features/models/` types 补 `key`；零新增依赖 |

## 4. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [OFFICIAL_API_REQ-007](../requirement/OFFICIAL_API_REQ-007_BACKEND_CHANNEL_PRESET.md) | 预置目录扩展（key + 国内外主流）+ `Provider.presetKey` + `POST /providers/from-preset` 一键开启（建渠道 + 自动导入模型） | 预置含国内外主流且带 key；from-preset 正确建渠道并导入模型；名称冲突/预置不存在返回明确错误；lint/typecheck/test 通过 |
| [OFFICIAL_API_REQ-008](../requirement/OFFICIAL_API_REQ-008_FRONTEND_OFFICIAL_CHANNEL.md) | 渠道管理页「官方直连」卡片区 + 开启弹窗（填 Key 一键开启） | 卡片默认未开启、按 presetKey 显示已开启数量；开启后可建渠道并提示导入模型数；lint/typecheck/build 通过 |

## 5. 里程碑

1. ✅ REQ-007 后端预置 + 一键开启端点。
2. ✅ REQ-008 前端官方直连卡片区。

## 6. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| C-01 | 国内/海外官方 Base URL 与模型 ID/倍率需人工核对 | 先「跑通再优化」，后续可改远程预置下发 |
| C-02 | `from-preset` 非强事务（渠道建成功后模型导入失败） | 前端提示重试导入；模型目录「官方预设导入」可补 |
| C-03 | Gemini 官方直连默认走 `api-key`（OAuth 服务账号仍走手动创建） | 保持现状，OAuth 走现有手动流程 |

## 7. 关联

- 上游：`OFFICIAL_API_PRESET_PLAN.md`、`MODEL_PROVIDER_PLAN.md`
- feature：`docs/feature/model_provider.md`
- requirement：见 §4
