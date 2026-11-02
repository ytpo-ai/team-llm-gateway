# TEAM_MANAGEMENT_REQ-003 系统管理员 + 菜单结构

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/system_admin.md`（主）、`docs/feature/usage_metering.md`、`docs/feature/team_member.md` |
| 所属 plan | `docs/plan/TEAM_MANAGEMENT_OPTIMIZATION_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/team-management-system-admin-menu` |
| 状态 | `draft` |

## 2. 需求描述

### 背景
现有单团队版 `team_admin` 即最高角色，`system`/`provider` 仅枚举预留未实现。本次落地系统管理员能力（建团队、邀团队管理员），并落地菜单结构调整（角色管理、使用日志明细）。

### 目标
- `system` 角色在单团队自部署模式可见，首个注册者为系统管理员。
- 权限层级 `system > team_admin > member`；只有 `system` 能创建团队、邀请团队管理员。
- 「system 具备 team_admin 全部能力但不直接管团队」采用**软约束**（技术不拦截，仅 UI 引导）。
- 「状态观察 → 使用日志」补分页明细接口（`UsageLog` 已存在，缺单笔分页列表）。
- 前端菜单落地：团队管理（成员/角色/API Key）、渠道模型（渠道/模型）、状态观察（用量/使用日志/操作日志）、系统设置。

### 验收条件
- [ ] `system` 可创建团队并邀请团队管理员，`team_admin` 无法创建团队。
- [ ] 权限层级生效（system 具备 team_admin 全部能力，软约束）。
- [ ] `GET /usage/logs` 分页明细接口可用（按时间/成员/key/模型/状态筛选）。
- [ ] 前端菜单结构完整，角色管理页、使用日志页可访问。
- [ ] `pnpm --filter portal-backend lint` / `typecheck` / `test` 通过。

## 3. 技术方案摘要
- 复用 `RolesGuard`/`@Roles()` 扩展角色层级（system 通过 team_admin 校验）。
- 使用日志明细复用 `UsageLog` 集合 + MongoDB 分页查询。
- 菜单/路由调整参考 `docs/issue/菜单优化.md`。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/TEAM_MANAGEMENT_REQ-003_DEVELOPMENT.md` |
| fix | — |

## 5. 状态跟踪
- [ ] 开发中
- [ ] 待验收
- [ ] 已交付
