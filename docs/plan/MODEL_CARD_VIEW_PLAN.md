# 模型列表卡片化与模型元信息扩展（MODEL_CARD_VIEW）

> 参考云厂商模型广场卡片（名称/简介/模态/上下文/倍率），将模型目录页从表格改为卡片网格，并扩展模型元信息字段。
>
> - 上游 plan：`docs/plan/MODEL_PROVIDER_PLAN.md`、`docs/plan/MODEL_MULTI_CHANNEL_PLAN.md`
> - feature：`docs/feature/model_provider.md`
> - 定稿时间：2026-11-06
> - 状态：已完成

---

## 1. 需求背景

当前模型目录页为表格展示，信息密度低，仅有 modelId/展示名/倍率/能力标签，缺少模型的基本介绍、上下文长度、模态支持等关键选型信息。参考云厂商模型卡片（输入/输出模态图标、上下文长度、最大输出长度），将模型列表卡片化，提升模型可读性与选型效率。

## 2. 目标

1. Model Schema 新增元信息字段：`description`、`contextLength`、`maxOutputLength`、`inputModalities`、`outputModalities`。
2. 官方预设（含服务商预设）补齐全部模型的简介、上下文、模态数据。
3. 模型目录页从表格改为卡片网格，卡片展示：展示名 + modelId、状态、简介（截断）、模态图标行（输入 → 输出）、上下文长度、最大输出、计费倍率、渠道 badges、操作按钮。
4. 添加/编辑模型表单支持新字段录入；预设导入携带并展示新字段。
5. 价格维度只展示倍率（×N），不引入具体单价字段；只保留卡片视图，不做表格切换。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 数据模型 | `description: string`（默认 `''`）；`contextLength/maxOutputLength: number \| null`（token 数，前端格式化为 1M/128K）；`inputModalities/outputModalities: string[]`（默认 `['text']`，枚举值 text/image/audio/video，不做强枚举校验，保持扩展性） |
| 向后兼容 | 新字段全部可选/有默认值，Mongoose hydrate 存量文档自动补默认值，无需迁移脚本 |
| API | `GET/POST/PATCH /models`、`POST /models/bulk`、`GET /models/presets` 请求/响应新增 5 个可选字段，向后兼容 |
| 卡片布局 | 响应式网格 `grid sm:grid-cols-2 xl:grid-cols-3`；shadcn Card 原语；模态用 lucide 图标（Type/Image/Video/Audio → Type）；空值显示「—」 |
| 表单 | 编辑/添加 Sheet 增加：简介、上下文长度、最大输出长度、输入/输出模态 checkbox 组 |

## 4. 影响范围

### 后端

| 文件 | 改动 |
|---|---|
| `schemas/model.schema.ts` | 新增 5 个字段 |
| `dto/create-model.dto.ts` / `update-model.dto.ts` / `bulk-create-model.dto.ts` | 新增可选校验字段 |
| `models.service.ts` | `ModelView` + `toView` + create/bulkCreate/update 透传 |
| `official-presets.ts` | `OfficialModelPreset` 接口扩展 + 全部预设数据补齐 |
| `models.service.spec.ts` | 覆盖新字段透传 |

### 前端

| 文件 | 改动 |
|---|---|
| `features/models/types.ts` | `Model`、`OfficialModelPreset`、`ModelInput`、`ModelPatch` 新增字段 |
| `features/models/api.ts` | `BulkModelItem` 新增字段 |
| `pages/models.tsx` | 表格 → 卡片网格；表单新增字段；预设导入携带新字段 |

## 5. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [MODEL_CARD_VIEW_REQ-001](../requirement/MODEL_CARD_VIEW_REQ-001_BACKEND.md) | 后端：Schema 扩展、DTO/Service 透传、预设数据补齐 | lint/typecheck/test 通过，API 可读写新字段，预设返回新字段 |
| [MODEL_CARD_VIEW_REQ-002](../requirement/MODEL_CARD_VIEW_REQ-002_FRONTEND.md) | 前端：类型更新、卡片网格视图、表单新字段、预设导入适配 | build 通过，卡片完整展示新字段，存量数据空值兜底 |

## 6. 里程碑

1. ✅ REQ-001 后端模型元信息扩展
2. ✅ REQ-002 前端卡片化展示与表单适配

## 7. 风险

| 编号 | 事项 | 状态 |
|---|---|---|
| R-01 | 存量模型无新字段，卡片简介/上下文为空 | 前端空值显示「—」，管理员可编辑补录 |
| R-02 | 配置了远程预设 URL（`modelPresets.url`）且为旧格式数据时新字段缺省 | 前端空值兜底，后端 DTO 全可选 |

## 8. 关联

- 上游：`MODEL_PROVIDER_PLAN.md`、`MODEL_MULTI_CHANNEL_PLAN.md`
- feature：`docs/feature/model_provider.md`
- UI 规范：`docs/rules/UI.md`
