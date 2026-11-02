# TEAM_MANAGEMENT_REQ-001 角色体系重构

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/team_member.md`（主）、`docs/feature/tenant_auth.md` |
| 所属 plan | `docs/plan/TEAM_MANAGEMENT_OPTIMIZATION_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/team-management-role-system` |
| 状态 | `in-review` |

## 2. 需求描述

### 背景
现有 `User.role` 同时承载「管理权限」与「成员能力」语义，且枚举含 `finance`/`viewer`/`provider` 冗余值；成员必须登录（`passwordHash` 必填）、必须填 `email`。本次重构为两层角色体系，明确角色A（管理范围，固定）与角色B（LLM 使用限制，可配置）。

### 目标
- 角色A 收敛为固定 3 值：`system` / `team_admin` / `member`，彻底废弃 `finance`/`viewer`/`provider`（枚举、守卫、测试、文档一并清理）。
- `User` 字段调整：`passwordHash` 改可选、`email` 改可选，新增 `roleTemplateId`（引用角色B）。
- `{ tenantId, email }` 唯一索引改为 partial/sparse 索引（仅对非空 email 唯一）。
- 登录判定改为「有密码才能登录」；无密码成员仅作员工标记。
- 新增角色B 实体 `RoleTemplate`（字段见 `docs/issue/团队管理功能的优化.md` §5），含内置模板 seed（设计师/开发人员等，`builtIn` 内置不可删）。
- 前端新增「团队管理 → 角色管理」页（角色B CRUD）。

### 验收条件
- [ ] `Role` 枚举仅含 `system`/`team_admin`/`member`，代码库无 `finance`/`viewer`/`provider` 残留。
- [ ] 成员可不设密码、可不填邮箱创建成功；无密码成员无法登录。
- [ ] `{ tenantId, email }` 部分唯一索引生效（多成员 email 为空不冲突）。
- [ ] `RoleTemplate` CRUD 可用，内置模板 seed 生效，`builtIn` 模板不可删除。
- [ ] 成员可绑定/解绑角色B（`roleTemplateId`）。
- [ ] 前端角色管理页可增删改查角色B。
- [ ] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过。

## 3. 技术方案摘要
- 复用 Nest.js + Mongoose + class-validator + Swagger 既有模式。
- 数据模型新增 `docs/technical/db_schema/ROLE_TEMPLATE_SCHEMA.MD`，更新 `TENANT_USER_SCHEMA.MD`。
- 角色层级 `system > team_admin > member` 由 `RolesGuard` 支持。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/TEAM_MANAGEMENT_REQ-001_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [x] 开发中
- [x] 待验收
- [ ] 已交付
