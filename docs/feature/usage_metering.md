# 计量与用量（usage_metering）

## 1. 功能设计

### 目标
- 请求日志采集、token 计量、成本计算（倍率 × token）。
- 团队/成员/key 三级聚合。
- 用量可视化：看板、趋势、按模型/成员/场景拆分。
- 落实 ADR-06「团队级细粒度计量」；初期 MongoDB 聚合。

### 数据结构
- 待设计（usage_log 集合 + 聚合索引）。

### 核心逻辑
- 待设计（计量上报格式见 D-05）。

## 2. 需求追溯

| Plan | Requirement | Development | Fix |
|------|------------|-------------|-----|
| [PORTAL_FOUNDATION](../plan/PORTAL_FOUNDATION_PLAN.md) | — | — | — |

## 3. 相关文档
- 技术文档：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-06、§7.1、D-05）

## 4. 相关代码文件
- 后端：`apps/portal-backend/src/modules/usage/`
- 前端：`apps/portal-frontend/src/features/usage/`
