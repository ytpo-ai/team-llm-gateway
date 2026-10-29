# USAGE_METERING_REQ-003 前端用量看板

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/usage_metering.md` |
| 所属 plan | `docs/plan/USAGE_METERING_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/usage-metering-frontend` |
| 状态 | `done` |

## 2. 需求描述

### 背景
`USAGE_METERING_REQ-001/002` 已交付计量查询 API 与转发层。现落地前端用量看板，改造 `dashboard` 占位页，接入路由与导航。

### 目标
- 新增 `features/usage/`（types、api）。
- 改造 `pages/dashboard.tsx`：总览卡片（请求数/token/成本）+ 时间范围/粒度选择 + 趋势图 + 按模型/成员/Key 拆分。
- 图表首期 SVG/CSS 轻量自绘（柱状/折线），不引重型图表库。
- 路由 `/`（概览）承载看板，无需新增路由，导航文案维持「概览」。

### 验收条件
- [x] `pnpm --filter portal-frontend dev` / `build` 通过。
- [x] 看板展示真实聚合数据（summary/trends/by-model/by-member/by-key）。
- [x] 空态友好（无数据时给出引导文案）。
- [x] `member` 仅看到本人数据，`team_admin` 看到团队全量（由后端 RBAC 保证，前端不做角色假设渲染）。

## 3. 技术方案摘要
- 复用 React + TypeScript + Tailwind + TanStack Query 既有模式（参考 `features/models/`、`pages/models.tsx`）。
- 数据契约见 `docs/technical/db_schema/USAGE_METERING_SCHEMA.MD` §5。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/USAGE_METERING_REQ-003_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [x] 已交付
