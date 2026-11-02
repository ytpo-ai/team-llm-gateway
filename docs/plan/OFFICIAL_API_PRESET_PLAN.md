# 官方 API 接入（前端 + 预置目录 + 探活）开发计划（OFFICIAL_API_PRESET）

> 本 plan 固化「官方 API 接入」的**前端交互 + 官方模型预置目录 + 上游连通性探活**，是 `docs/plan/OFFICIAL_API_PLAN.md`（后端协议翻译层）的姊妹 plan。
>
> - 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-13、§5.2）
> - 上游 plan：`docs/plan/OFFICIAL_API_PLAN.md`（协议类型就绪后承接）、`docs/plan/MODEL_PROVIDER_PLAN.md`（M-03 连通性探活在本 plan 闭环）
> - 定稿时间：2026-10-29
> - 状态：已完成

---

## 1. 需求背景

后端协议翻译层（OFFICIAL_API）交付后，`Provider` 支持 `openai-compatible / anthropic / gemini` 三类官方协议，但前端仍只能选 `openai-compatible`，团队需手动逐条录入官方模型 ID 与能力标签，且无法验证上游 key 是否可用。现落地前端类型选择、官方模型预置目录（一键填充）与连通性探活（`POST /providers/:id/test`），降低团队接入官方的门槛。

## 2. 目标

1. 前端 provider 创建/编辑表单支持选择类型（`openai-compatible` / `anthropic` / `gemini`），展示对应 baseUrl 占位提示。
2. 官方模型预置目录：内置常见官方模型（ID / 展示名 / 能力标签 / 默认倍率），选官方后一键批量填充团队 `Model` 目录。
3. 连通性探活：`POST /providers/:id/test`（后端发起一次最小探测请求，返回成功/失败与延迟），前端「测试连接」按钮。
4. 前端模型目录页支持「从官方预设导入」。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 官方预置目录 | 静态常量（不落库），与 `model_recommendation` 的 `capabilities` 标签字典对齐；按 `type` 分组（openai/anthropic/gemini 官方模型） |
| 预置导入 | 前端选官方 → 列表勾选模型 → 批量 `POST /models/bulk`（复用 `models` 模块，`providerId` 绑定当前渠道，能力标签/倍率取自预设，可再编辑） |
| 连通性探活 | 后端新增 `POST /providers/:id/test`：解密 key → 按 `type` 用适配器发最小请求（如 Gemini 用 `:generateContent` 空内容、Anthropic 用最小 `messages`）→ 返回 `{ ok, latencyMs, message }`；不落库、不计量 |
| RBAC | 探活与预置导入均 `team_admin`（与 providers/models 写操作一致） |
| 前端 | `features/providers/` 扩展类型选择与测试按钮；`features/models/` 扩展预置导入；零新增依赖 |

## 4. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [OFFICIAL_API_REQ-004](../requirement/OFFICIAL_API_REQ-004_FRONTEND_PRESET_PROBE.md) | 前端类型选择 + 官方模型预置目录导入 + 连通性探活（后端 test 接口 + 前端按钮） | 前端可选三类协议并正确提示；预置一键导入成功；test 接口返回真实连通结果；lint/typecheck/test/build 通过 |

## 5. 里程碑

1. ✅ REQ-004 前端类型选择 + 预置目录 + 探活（本文档拆解，闭环 MODEL_PROVIDER M-03）。

## 6. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| P-01 | 官方预置目录的模型清单来源与更新机制 | 首期静态常量维护，后续可做远程拉取 |
| P-02 | 探活请求对官方 API 的计费影响 | 使用最小/零 token 探测，不计量；需在文档注明探测成本 |

## 7. 关联

- 上游：`OFFICIAL_API_PLAN.md`、`MODEL_PROVIDER_PLAN.md`
- feature：`docs/feature/model_provider.md`
- requirement：见 §4
