# MODEL_CARD_VIEW_REQ-002 前端模型卡片化展示与表单适配

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
后端已扩展模型元信息字段，前端模型目录页需从表格改为卡片网格并展示新字段。

### 目标
- `features/models/types.ts` / `api.ts` 同步新字段
- 模型列表表格 → 响应式卡片网格，卡片展示：展示名 + modelId、状态、简介（2 行截断）、模态图标行（输入 → 输出）、上下文长度、最大输出、倍率 ×N、渠道 badges、操作按钮（仅 admin）
- 添加/编辑 Sheet 表单新增：简介、上下文长度、最大输出长度、输入/输出模态选择
- 预设导入 Sheet 展示并携带新字段
- 空/加载/错误三态保留，空值显示「—」

### 验收条件
- [x] `pnpm --filter portal-frontend build` / `lint` 通过
- [x] 卡片完整展示新字段，存量数据空值兜底正常
- [x] 添加/编辑可录入新字段，预设导入携带新字段
- [x] dark 模式显示正常

## 3. 技术方案摘要
- 遵循 `docs/rules/UI.md`：shadcn Card 原语、语义 token、lucide 图标
- 模态图标映射：text→Type、image→Image、video→Video、audio→Audio
- 上下文格式化：≥1M 显示 `xM`，≥1K 显示 `xK`

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | — |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付


