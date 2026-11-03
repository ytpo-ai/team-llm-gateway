# 团队管理功能优化计划（TEAM_MANAGEMENT）

> 本 plan 固化「团队管理功能优化」的工程方案，落地两层角色体系、三级限额模型、系统管理员能力与菜单结构改造。
>
> - 需求来源：`docs/issue/团队管理功能的优化.md`、`docs/issue/菜单优化.md`（讨论结论已定稿）
> - 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-03/06/10、D-04）
> - 定稿时间：2026-11-02
> - 状态：进行中

---

## 1. 需求背景

现有「团队与成员」模块以 `User`（登录账号）+ `role`（RBAC 角色）为核心，`role` 同时承载了「管理权限」与「成员能力」两种语义，且成员必须登录、必须填邮箱。本次优化明确：

1. 成员与登录账号不分离，`User.passwordHash`/`email` 改为可选（无密码不可登录）。
2. 角色拆为两层：**角色A（管理范围，固定）** 与 **角色B（LLM 使用限制，可配置）**。
3. 三级限额：团队 / 成员 / apikey 的日/周/月使用限额，生效值取最严格。
4. 引入系统管理员（`system`）角色，明确建团队/邀团队管理员的边界。
5. 菜单结构调整（新增角色管理、使用日志明细等）。

## 2. 目标

1. 角色A 收敛为固定 3 值：`system` / `team_admin` / `member`，废弃 `finance`/`viewer`/`provider`。
2. 新增角色B 实体 `RoleTemplate`（内置常用模板，可配置）。
3. `User` 字段调整：`passwordHash`/`email` 可选，新增 `roleTemplateId`。
4. 三级限额（日/周/月）+ 渠道白名单，转发层取 min 生效。
5. `system` 角色可见（自部署模式），具备建团队、邀团队管理员能力，软约束。
6. 菜单结构落地 + 「使用日志」分页明细接口。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 角色A | `Role` 枚举收敛为 `system`/`team_admin`/`member`；清理 `finance`/`viewer`/`provider` 相关代码/守卫/测试/文档 |
| 角色B | 新增 `RoleTemplate` 集合（name/description/limitDaily/limitWeekly/limitMonthly/rateLimitPerMinute/providerIds/modelWhitelist/builtIn）；内置模板 seed；`User.roleTemplateId` 引用 |
| 成员模型 | `User.passwordHash`/`email` 改可选；`{ tenantId, email }` 唯一索引改 partial；登录判定改为「有密码才能登录」 |
| 权限层级 | `system > team_admin > member`；`system` 具备 `team_admin` 全部能力（软约束，技术不拦截，仅 UI 引导） |
| 三级限额 | 余额账户仅 team/member；限额（日/周/月）team/member/apikey 三级，生效值 = min；apikey 只限额不持余额；成员限额继承角色B（预留 override） |
| 渠道白名单 | team/member/key 三级 `providerIds` 白名单（渠道 = Provider） |
| 菜单 | 新增「团队管理→角色管理」「状态观察→使用日志」分页明细；其余映射现有能力 |
| 数据模型 | 新增 `docs/technical/db_schema/ROLE_TEMPLATE_SCHEMA.MD`；更新 `TENANT_USER_SCHEMA.MD`、`API_KEY_SCHEMA.MD`、`BILLING_QUOTA_SCHEMA.MD` 等 |

## 4. Requirement 拆解

| Requirement | 内容 | 主要涉及 feature | 验收条件 |
|---|---|---|---|
| [REQ-001 角色体系重构](../requirement/TEAM_MANAGEMENT_REQ-001_ROLE_SYSTEM.md) | 角色A 枚举收敛、User 字段调整、RoleTemplate 实体 + 内置模板、前端角色管理页 | team_member、tenant_auth | 枚举收敛且旧值无残留；RoleTemplate CRUD 可用；成员可绑定角色B；lint/typecheck/test 通过 |
| [REQ-002 三级限额模型](../requirement/TEAM_MANAGEMENT_REQ-002_QUOTA_LIMIT.md) | 三级日/周/月限额 + 渠道白名单 + 转发层 min 生效 + 成员继承角色B | billing_quota、api_key | 超额拦截生效；min 生效逻辑正确；渠道白名单生效；lint/typecheck/test 通过 |
| [REQ-003 系统管理员 + 菜单](../requirement/TEAM_MANAGEMENT_REQ-003_SYSTEM_ADMIN_MENU.md) | system 建团队/邀团队管理员、软约束、使用日志分页明细、菜单落地 | system_admin、usage_metering | system 可建团队并指派团队管理员；菜单结构完整；使用日志分页可用；lint/typecheck/test 通过 |

## 5. 里程碑

1. 🔄 REQ-001 角色体系重构（角色A 收敛 + RoleTemplate）。
2. 🔄 REQ-002 三级限额模型。
3. 🔄 REQ-003 系统管理员 + 菜单结构。

> 依赖关系：REQ-002 依赖 REQ-001（成员角色B 提供限额默认值）；REQ-003 依赖 REQ-001（system 角色）。建议按序推进。

## 6. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| T-01 | 单成员限额 override（成员详情页单独调整限额） | 本期不做，数据模型预留 override 扩展点 |
| T-02 | 角色B 字段细化（缓存计费、阶梯价、场景标签等） | 先跑通再优化 |
| T-03 | `finance`/`viewer`/`provider` 废弃后的历史数据迁移 | 需评估现有库中是否已有这些角色值，决定迁移或直接清空 |
| R-01 | Role 枚举收敛波及 `auth`/`RolesGuard`/各模块 `@Roles` 装饰器及既有测试 | 本次一并清理 |
| R-02 | `{ tenantId, email }` 唯一索引改为 partial 可能影响既有唯一性假设 | 需更新相关测试 |

## 7. 关联

- 上游：`docs/issue/团队管理功能的优化.md`、`docs/issue/菜单优化.md`、`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`
- feature：`docs/feature/team_member.md`、`tenant_auth.md`、`billing_quota.md`、`api_key.md`、`usage_metering.md`、`system_admin.md`
- 数据模型：新增 `docs/technical/db_schema/ROLE_TEMPLATE_SCHEMA.MD`；更新 `TENANT_USER_SCHEMA.MD` 等
- requirement：见 §4
