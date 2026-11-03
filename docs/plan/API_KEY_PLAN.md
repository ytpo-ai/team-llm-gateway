# API Key 管理模块开发计划（API_KEY）

> 本 plan 固化 Portal 业务模块 **API Key 管理（api_key）** 的工程方案，落地 ADR-06「团队 → 成员(角色) → 多 key → 每 key 细粒度限制」层级中的 key 层，以及 ADR-09「成员 key 由 Portal 自己签发」。
>
> - 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-03/06/09、§5.2、§7.1）
> - 上游 plan：`docs/plan/TEAM_MEMBER_PLAN.md`（团队与成员已交付，复用其 Team/User/RBAC/tenantId 上下文）
> - 定稿时间：2026-10-28
> - 状态：已完成

---

## 1. 需求背景

`team_member` 已交付（Team + User.teamId + 邀请制 + RBAC）。现落地「API Key 管理」模块：key 归属成员，每 key 支持细粒度 LLM 使用限制（模型白名单 / 速率限制 / 预算上限 / 过期时间），key 哈希存储（仅展示前缀 + 完整值一次性），key 用量归属到成员/团队，为下游 `usage_metering` 提供「用量归谁」的上下文。

## 2. 目标

1. 新增 `ApiKey` 实体（多租户内建，归属 `tenantId → teamId → userId`）。
2. key 签发/吊销/轮换；完整 key 值仅在创建/轮换时返回一次，落库仅存 sha256 哈希 + 展示前缀。
3. 每 key 细粒度限制字段：`allowedModels`、`rateLimitPerMinute`、`maxTokens`、`expiresAt`。
4. RBAC：普通成员仅能操作自己的 key；`team_admin` 可查看/吊销全团队 key。
5. 前端 API Key 管理页（列表/创建一次性展示/吊销/轮换/编辑限制）。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 数据模型 | 新增 `ApiKey` 集合；详见 `docs/technical/db_schema/API_KEY_SCHEMA.MD` |
| key 生成 | `pk_` + `randomBytes(24).toString('base64url')`；`keyHash` = sha256(完整值) 唯一索引；`keyPrefix` = 前缀 12 字符用于列表展示 |
| key 存储 | 只落 `keyHash` + `keyPrefix`，明文 key 绝不落库；仅创建/轮换接口返回一次 |
| 细粒度限制 | `allowedModels`（string[]，缺省=不限）、`rateLimitPerMinute`（number，缺省=不限）、`maxTokens`（number，token 预算上限，缺省=不限）、`expiresAt`（Date，缺省=永久） |
| 团队隔离 | `ApiKey` 携带 `tenantId` / `teamId`，查询按租户过滤（沿用 D-04 起点约定） |
| 鉴权 | 复用 `JwtAuthGuard` / `RolesGuard` / `@Roles()` / `@CurrentUser()`；RBAC 见 §4 |
| 用量归属 | `userId` / `teamId` / `tenantId` 三级归属字段固化，`lastUsedAt` 预留供计量模块写入 |

## 4. RBAC 设计

| 角色 | 权限 |
|---|---|
| `member` / `finance` / `viewer` | 创建、查看、吊销**自己的** key |
| `team_admin` | 查看、吊销**全团队** key（`GET /api-keys?userId=` 过滤） |

- 吊销（`DELETE`）为软删除语义：`status: active → revoked`，不物理删除。
- 轮换（`rotate`）：新建一把 key + 吊销旧 key（`active → revoked`）。

## 5. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [API_KEY_REQ-001](../requirement/API_KEY_REQ-001_BACKEND_KEY.md) | 后端：ApiKey schema、api-keys 模块 CRUD/轮换、哈希+前缀存储、RBAC、租户隔离 | `start:dev` 启动，Swagger 可调 api-keys 各接口，Mongo 落库仅存哈希，lint/typecheck/test 通过 |
| [API_KEY_REQ-002](../requirement/API_KEY_REQ-002_FRONTEND_KEY.md) | 前端：API Key 列表/创建一次性展示/吊销/轮换/编辑限制、路由 `/api-keys`、导航接入 | `dev`/`build` 通过，创建→展示完整 key→复制→列表可见→吊销/轮换闭环可用 |

## 6. 里程碑

1. ✅ REQ-001 后端 API Key（本文档拆解）。
2. ✅ REQ-002 前端 API Key 管理闭环。
3. ⬜ 下游模块（usage_metering → model_provider → …）复用 key 归属与限制字段。

## 7. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| A-01 | 预算上限维度：token 维度（`maxTokens`）已固化，成本（USD）维度需 `model_provider` 模型倍率 | 首期 token 维度，成本维度留待 model_provider 交付后扩展 |
| A-02 | 限制的强制执行点：速率/预算/白名单真正校验在后续代理路由层/计量层执行 | 本模块仅存储与 CRUD、固化字段，执行留待下游 |
| A-03 | `lastUsedAt` 的更新来源 | 由后续请求路径/计量模块写入，本模块仅定义字段 |
| A-04 | key 前缀格式与外部兼容性（`sk-` vs `pk_`） | 首期 `pk_`，若需兼容 OpenAI/网关约定再统一调整 |

## 8. 关联

- 上游：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`、`TEAM_MEMBER_PLAN.md`
- feature：`docs/feature/api_key.md`
- 数据模型：`docs/technical/db_schema/API_KEY_SCHEMA.MD`（本 plan 新增）
- requirement：见 §5
