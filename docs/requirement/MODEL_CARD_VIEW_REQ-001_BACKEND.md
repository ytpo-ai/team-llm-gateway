# MODEL_CARD_VIEW_REQ-001 后端模型元信息扩展

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/model_provider.md` |
| 所属 plan | `docs/plan/MODEL_CARD_VIEW_PLAN.md` |
| 需求管理 ID | — |
| 分支 | — |
| 状态 | `done` |

## 2. 需求描述

### 背景
模型卡片需要展示简介、上下文长度、最大输出长度、输入/输出模态，当前 Model Schema 缺少这些字段。

### 目标
- `model.schema.ts` 新增：`description`（string，默认 `''`）、`contextLength`（number|null，默认 null）、`maxOutputLength`（number|null，默认 null）、`inputModalities`（string[]，默认 `['text']`）、`outputModalities`（string[]，默认 `['text']`）
- Create/Update/Bulk DTO 新增对应可选字段校验
- `ModelView`、`toView`、create/bulkCreate/update 全链路透传
- `official-presets.ts` 接口扩展并为全部预设模型补齐新字段数据
- 更新 `models.service.spec.ts` 覆盖新字段

### 验收条件
- [x] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过
- [x] POST/PATCH `/models` 可写入并读回新字段
- [x] GET `/models/presets` 返回的预设模型包含新字段
- [x] 存量文档（无新字段）读取正常，自动补默认值

## 3. 技术方案摘要
- Mongoose 新增字段全部带默认值或 nullable，存量文档 hydrate 自动补默认，无需迁移
- 模态字段不做强枚举（string[]），保持扩展性；约定取值 text/image/audio/video
- 预设数据按各厂商公开规格填写（上下文 token 数）

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | — |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付


