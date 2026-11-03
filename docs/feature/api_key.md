# API Key 管理（api_key）

## 1. 功能设计

### 目标
- key 签发/吊销/轮换，key 归属成员。
- 每 key 细粒度限制：模型白名单、速率限制、预算上限、过期时间。
- key 用量归属到成员/团队（与计量模块联动）。
- 落实 ADR-06「每 key 细粒度设置 LLM 使用限制」、ADR-09「成员 key 由 Portal 签发」。

### 数据结构
- `ApiKey`：`docs/technical/db_schema/API_KEY_SCHEMA.MD`（key 哈希存储，仅展示前缀 + 完整值一次性）。

### 核心逻辑
- key 生成 `pk_` + base64url；`keyHash`（sha256 唯一）落库，`keyPrefix` 用于展示。
- 吊销为软删除（`active → revoked`）；轮换 = 新建 + 吊销旧 key。
- RBAC：普通成员仅能操作自己的 key；`team_admin` 可看全团队 key。

## 2. 需求追溯

| Plan | Requirement | Development | Fix |
|------|------------|-------------|-----|
| [API_KEY](../plan/API_KEY_PLAN.md) | [REQ-001 后端 API Key](../requirement/API_KEY_REQ-001_BACKEND_KEY.md) | [开发记录](../development/API_KEY_REQ-001_DEVELOPMENT.md) | — |
| 同上 | [REQ-002 前端 API Key 管理](../requirement/API_KEY_REQ-002_FRONTEND_KEY.md) | [开发记录](../development/API_KEY_REQ-002_DEVELOPMENT.md) | — |
| [TEAM_MANAGEMENT_OPTIMIZATION](../plan/TEAM_MANAGEMENT_OPTIMIZATION_PLAN.md) | [REQ-002 三级限额模型](../requirement/TEAM_MANAGEMENT_REQ-002_QUOTA_LIMIT.md) | [开发记录](../development/TEAM_MANAGEMENT_REQ-002_DEVELOPMENT.md) | — |
| [API_KEY_MEMBER_BINDING](../plan/API_KEY_MEMBER_BINDING_PLAN.md) | [REQ-003 后端成员绑定与聚合](../requirement/API_KEY_REQ-003_BACKEND_MEMBER_BINDING.md) | [开发记录](../development/API_KEY_REQ-003_DEVELOPMENT.md) | — |
| 同上 | [REQ-004 前端成员绑定与展示](../requirement/API_KEY_REQ-004_FRONTEND_MEMBER_BINDING.md) | [开发记录](../development/API_KEY_REQ-004_DEVELOPMENT.md) | — |

## 3. 相关文档
- 技术文档：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-06/09、§7.1）、`docs/technical/db_schema/API_KEY_SCHEMA.MD`
- 规划文档：`docs/plan/API_KEY_PLAN.md`
- 上游：`docs/plan/TEAM_MEMBER_PLAN.md`

## 4. 相关代码文件
- 后端：`apps/portal-backend/src/modules/api-keys/`
- 前端：`apps/portal-frontend/src/features/api-keys/`、`pages/api-keys.tsx`
