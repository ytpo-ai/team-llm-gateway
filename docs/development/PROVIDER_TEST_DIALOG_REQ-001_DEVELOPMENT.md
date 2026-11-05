# PROVIDER_TEST_DIALOG_REQ-001 开发记录（测试弹窗交互优化）

> 对应需求：`docs/requirement/PROVIDER_TEST_DIALOG_REQ-001_TEST_DIALOG.md`
> 对应计划：`docs/plan/PROVIDER_TEST_DIALOG_PLAN.md`
> 分支：`main`

## 1. 实现摘要

将渠道测试从内联一键触发升级为抽屉式批量测试交互，支持模型选择、自定义消息、批量测试、一键导入通过模型、点击查看模型回复。

- 后端新增 `POST /providers/:id/batch-test`：接收 `modelIds[]` + 可选 `message`，逐一测试返回 `{ results: [{ modelId, ok, latencyMs, message, reply }] }`
- 后端新增 `POST /providers/:id/sync-models`：根据渠道 `presetKey` 自动补全预置缺失模型
- 后端 `POST /providers/:id/test` 增强：支持可选 `modelId`/`message`，`max_tokens` 提至 1024，解析并返回三种协议的模型回复
- 前端 Dialog → Sheet 右侧抽屉：预置全部模型平铺 checkbox 列表，支持全选/单选/批量测试
- 测试通过模型一键导入团队目录，测试结果可点击展开查看模型回复

## 2. 代码改动点

### 后端

| 文件 | 说明 |
|---|---|
| `dto/test-provider.dto.ts` | 新增 `TestProviderDto`（可选 `modelId`、`message`） |
| `dto/batch-test-provider.dto.ts` | 新增 `BatchTestProviderDto`（`modelIds[]` + 可选 `message`） |
| `providers.service.ts` | `ProviderProbeResult` 新增 `modelId?`、`reply?`；新增 `extractReply()` 解析三种协议回复；`test()` 支持可选参数和回复提取；新增 `batchTest()` 批量测试；新增 `syncPresetModels()` 预置同步 |
| `providers.controller.ts` | `POST :id/test` 接收 `@Body()`；新增 `POST :id/batch-test`、`POST :id/sync-models` |

### 前端

| 文件 | 说明 |
|---|---|
| `features/providers/types.ts` | `ProviderProbeResult` 新增 `modelId?`、`reply?` |
| `features/providers/api.ts` | 新增 `batchTestProvider()`、`TestProviderInput`、`BatchTestInput`、`BatchTestResult` |
| `pages/providers.tsx` | 测试按钮打开 Sheet 抽屉；预置模型平铺 checkbox 列表 + 全选；`batchTestMutation` 批量测试；`importMutation` 一键导入通过模型；`expandedReplies` 点击展开模型回复；移除旧的 Dialog 和内联探测结果 |

## 3. 关键设计决策

| 决策 | 说明 |
|---|---|
| 预置模型作为测试清单来源 | 对于有 `presetKey` 的渠道，拉取预置全部模型供测试，而非仅显示已导入模型 |
| 批量测试顺序执行 | `batchTest()` 内 `for...of` 顺序测试，避免并发打爆上游 |
| 三种协议回复解析 | `extractReply()`：OpenAI→`choices[0].message.content`，Anthropic→`content[].text`，Gemini→`candidates[0].content.parts[].text` |
| `modelId` 透传 | 批量结果每项带 `modelId`，前端按 key 更新结果状态 |

## 4. 验证

- [x] 后端 typecheck / lint 通过
- [x] 前端 typecheck / lint / build 通过
- [x] 仅预置渠道显示模型列表，无预设渠道提示"暂无可测试模型"
- [x] 全选/单选/批量测试/导入通过模型 流程闭环
- [x] 已导入模型显示蓝色标签
- [x] 测试结果可点击展开/收起模型回复