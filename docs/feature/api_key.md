# API Key 管理（api_key）

## 1. 功能设计

### 目标
- key 签发/吊销/轮换，key 归属成员。
- 每 key 细粒度限制：模型白名单、速率限制、预算上限、过期时间。
- key 用量归属到成员/团队（与计量模块联动）。
- 落实 ADR-06「每 key 细粒度设置 LLM 使用限制」。

### 数据结构
- 待设计（key 哈希存储，仅展示前缀 + 完整值一次性）。

### 核心逻辑
- 待设计。

## 2. 需求追溯

| Plan | Requirement | Development | Fix |
|------|------------|-------------|-----|
| [PORTAL_FOUNDATION](../plan/PORTAL_FOUNDATION_PLAN.md) | — | — | — |

## 3. 相关文档
- 技术文档：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-06/09、§7.1）

## 4. 相关代码文件
- 后端：`apps/portal-backend/src/modules/api-key/`
- 前端：`apps/portal-frontend/src/features/api-key/`
