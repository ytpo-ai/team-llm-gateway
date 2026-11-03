# 角色模板数据模型（RoleTemplate）

> 所属模块：`docs/feature/team_member.md`（角色B）；上游 plan：`docs/plan/TEAM_MANAGEMENT_OPTIMIZATION_PLAN.md`（REQ-001）
>
> 本文件固化 `RoleTemplate`（角色B，LLM 使用限制模板）的 Mongoose Schema 定义，作为角色体系第二层（使用能力）的单一事实来源。

---

## 1. 设计原则

- **两层角色**：角色A（管理范围，固定 `system`/`team_admin`/`member`，存于 `User.role`）与角色B（LLM 使用限制，可配置，`User.roleTemplateId` 引用本集合）。
- **多租户内建**：团队自定义模板携带 `tenantId` + `teamId`；内置模板 `tenantId`/`teamId` 为 `null`（全局共享）。
- **内置不可删**：`builtIn = true` 的模板为系统内置（应用启动时 seed），仅可修改、不可删除。

## 2. RoleTemplate（角色模板）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `_id` | ObjectId | 主键 | 自动生成 |
| `tenantId` | ObjectId | 可选、ref `Tenant`、索引 | 所属租户；内置模板为 `null` |
| `teamId` | ObjectId | 可选、ref `Team`、索引 | 所属团队；内置模板为 `null` |
| `name` | string | 必填、trim | 模板名（如「设计师」「开发人员」） |
| `description` | string | 默认 `''` | 说明 |
| `policySetId` | ObjectId | 可选、ref `PolicySet`、索引、默认 `null` | 绑定的策略集（`null` = 不限） |
| `builtIn` | boolean | 默认 `false` | 是否内置模板 |
| `createdAt` | Date | 自动 | 创建时间 |
| `updatedAt` | Date | 自动 | 更新时间 |

**索引**：`{ tenantId: 1, teamId: 1, name: 1 }`。

> 限额字段（`limitDaily/Weekly/Monthly`、`rateLimitPerMinute`、`providerIds`、`modelWhitelist`）已策略化迁入 `PolicySet`（见 `POLICY_SET_SCHEMA.MD`），模板仅保留 `policySetId` 引用挂载。

## 3. User 增量变更

在 `TENANT_USER_SCHEMA.MD` 基础上新增：

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `roleTemplateId` | ObjectId | 可选、ref `RoleTemplate`、索引、默认 `null` | 绑定的角色B（LLM 使用限制模板） |

## 4. 内置模板

应用启动时确保以下内置模板存在（`builtIn = true`、`tenantId`/`teamId` 为 `null`），并关联同名内置策略集（`builtIn = true`、`teamId = null`，见 `POLICY_SET_SCHEMA.MD`）：

| 名称 | 说明 | 默认限制 |
|---|---|---|
| 设计师 | 面向设计团队的默认配置 | 全部不限、全渠道 |
| 开发人员 | 面向开发团队的默认配置 | 全部不限、全渠道 |

> 字段值「先跑通再优化」，内置策略集默认全部放开，由管理员按需编辑。

## 5. 查询可见性

- `list` 返回：`{ $or: [ { builtIn: true }, { tenantId, teamId } ] }`（内置模板对所有团队可见，自定义模板仅本团队可见）。
- 成员绑定角色B 后，其限额继承自模板所挂载的策略集（转发层按 `RoleTemplate.policySetId` 下发）。
