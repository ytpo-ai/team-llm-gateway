# OFFICIAL_API_REQ-004 前端类型选择 + 官方模型预置目录 + 连通性探活

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/model_provider.md` |
| 所属 plan | `docs/plan/OFFICIAL_API_PRESET_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/official-api-preset-probe` |
| 状态 | `done` |

## 2. 需求描述

### 背景
后端协议翻译层交付后，前端 provider 表单仍只能选 `openai-compatible`，团队需手动录入官方模型，且无法验证上游 key 可用性。现补齐前端交互、官方模型预置目录一键导入与连通性探活。

### 目标
- 前端 provider 创建/编辑表单支持选择类型（`openai-compatible` / `anthropic` / `gemini`），按类型展示 baseUrl 占位提示（如 Anthropic `https://api.anthropic.com`、Gemini `https://generativelanguage.googleapis.com`）。
- 官方模型预置目录（静态常量，按 `type` 分组，含 modelId / displayName / capabilities / 默认倍率），前端「从官方预设导入」弹窗 → 勾选 → 批量创建团队 `Model`（绑定当前 `providerId`）。
- 后端连通性探活 `POST /providers/:id/test`：解密 key → 按 `type` 用适配器发最小探测请求 → 返回 `{ ok, latencyMs, message }`（不落库、不计量）。
- 前端 provider 列表/表单新增「测试连接」按钮，展示探测结果与延迟。
- 后端模型目录新增 `POST /models/bulk`（批量导入预置模型，校验 `providerId` 同团队归属）。

### 验收条件
- [x] 前端可创建/编辑三种类型 provider，类型与占位提示正确。
- [x] 「测试连接」调用 `POST /providers/:id/test`，返回真实连通结果（成功/失败 + 延迟）。
- [x] 官方预设导入：勾选模型后批量创建成功，列表可见，能力标签/倍率可再编辑。
- [x] RBAC：探活与批量导入仅 `team_admin`。
- [x] `pnpm --filter portal-backend lint`/`typecheck`/`test` 与前端 `lint`/`typecheck`/`build` 通过。

## 3. 技术方案摘要
- 预置目录与探活方案见 `docs/plan/OFFICIAL_API_PRESET_PLAN.md` §3。
- 探活使用最小/零 token 探测请求，不触发计量；文档需注明探测成本（P-02）。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/OFFICIAL_API_REQ-004_DEVELOPMENT.md`（待补充） |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
