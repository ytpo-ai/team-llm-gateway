# 渠道测试弹窗优化开发计划（PROVIDER_TEST_DIALOG）

> 本 plan 优化现有「渠道测试」按钮交互：从内联一键触发升级为弹窗交互，支持选择模型和自定义测试消息。
>
> - 上游 plan：`docs/plan/OFFICIAL_API_PRESET_PLAN.md`（原始探活功能）
> - 定稿时间：2026-11-05
> - 状态：已完成

---

## 1. 需求背景

当前「渠道测试」按钮为内联一键触发（点击后直接调用 `POST /providers/:id/test`），后端自动选取探测模型并发送固定 `"ping"` 消息。用户无法选择使用哪个模型测试，也无法自定义测试消息，交互能力有限。现优化为弹窗交互，支持模型选择和自定义消息。

## 2. 目标

1. 点击「测试」按钮弹出 Dialog，包含模型下拉菜单、拉取模型按钮、自定义消息输入框。
2. 模型下拉菜单展示该渠道下的模型列表（通过 `GET /models` 过滤 `providerId`）。
3. 右侧「拉取模型」按钮可重新获取最新模型列表。
4. 消息输入框默认值 `"请问你是哪个模型？"`，用户可修改。
5. 后端 `POST /providers/:id/test` 支持接收可选的 `modelId` 和 `message` 参数。
6. 测试结果在弹窗内展示。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 后端 DTO | 新增 `TestProviderDto`，含可选 `modelId?: string`、`message?: string` |
| 后端 service | `test()` 方法新增可选参数，优先使用传入的 modelId/message，否则回退到原有自动探测逻辑 |
| 后端 controller | `@Post(':id/test')` 新增 `@Body()` 接收参数 |
| 前端 API | `testProvider(id, body?)` 支持传入可选 body |
| 前端 Dialog | 复用现有 shadcn/ui `Dialog` 组件；模型下拉用 `Select`；拉取按钮用 `Button`；消息输入用 `Input`；同步反馈提示 |
| 模型列表 | 调用 `listModels()` 并过滤 `providerId === provider.id`，优先展示 `active` 模型 |
| 模型同步 | 新增 `POST /providers/:id/sync-models`，根据渠道 `presetKey` 自动补全缺失预置模型 |
| RBAC | 不变，仍为 `team_admin` |

## 4. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [PROVIDER_TEST_DIALOG_REQ-001](../requirement/PROVIDER_TEST_DIALOG_REQ-001_TEST_DIALOG.md) | 后端 test 接口支持可选参数 + 前端弹窗交互 | 弹窗可选择模型、拉取模型、自定义消息、执行测试并展示结果；lint/typecheck/build 通过 |

## 5. 里程碑

1. ✅ REQ-001 后端 test 接口扩展 + 前端弹窗交互 + 拉取模型从预置导入（本文档拆解）。

## 6. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| P-01 | 若该渠道下无模型，下拉菜单提示"暂无模型" | ✅ 已纳入方案 |
| P-02 | 用户未选模型时仍可测试（后端自动探测） | ✅ 已纳入方案（modelId 为可选） |

## 7. 关联

- 上游：`OFFICIAL_API_PRESET_PLAN.md`、`MODEL_PROVIDER_PLAN.md`
- feature：`docs/feature/model_provider.md`
- requirement：见 §4