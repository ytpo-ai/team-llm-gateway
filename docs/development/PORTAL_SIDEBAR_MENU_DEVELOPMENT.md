# Portal 左侧分组侧边栏菜单 开发记录

> 需求来源：`docs/issue/菜单优化.md`（在「团队管理/渠道模型/状态观察/系统设置」基础上，按用户最新要求收敛为分组侧边栏）
> 分支：`main`

## 1. 实现摘要

将 `app-layout.tsx` 的顶部水平导航重构为**左侧固定分组侧边栏**，按分组叠放菜单：

| 分组 | 菜单项 | 可见性 |
|---|---|---|
| 团队管理 | 成员管理 `/team`、角色管理 `/roles`、策略管理 `/policy-sets`、API Key `/api-keys`、选型建议 `/recommendation` | — |
| LLM管理 | 渠道管理 `/providers`、模型管理 `/models`、额度与计费 `/billing` | 渠道管理仅 team_admin/system |
| 系统设置 | 系统设置 `/settings`、租户管理 `/admin/tenants`、全局看板 `/admin/overview` | 设置仅 team_admin/system；租户/全局看板仅 system |
| 观察 | 用量看板 `/`、使用日志 `/usage-logs`、审计日志 `/audit-logs` | 使用/审计日志仅 team_admin/system |

- 侧边栏顶部为 Portal 品牌标题，底部展示当前用户名；主题切换、退出登录保留在顶部 header 右侧。
- 「渠道管理/模型管理/额度与计费」从团队管理独立为 **LLM管理** 分组（按用户确认）。

## 2. 代码改动点

| 文件 | 说明 |
|---|---|
| `apps/portal-frontend/src/components/layout/app-layout.tsx` | 重写为「左侧固定侧边栏 + 顶部 header + 主内容区」布局；引入 `NavSection`/`NavItem` 结构描述分组菜单，按角色组装分组并过滤空组 |

## 3. 踩坑记录

1. **角色可见性不能丢失**：原导航中 `providers`/`settings`/`usage-logs`/`audit-logs` 依赖 `isTeamManager`，`admin/*` 依赖 `system`。迁移到分组结构后，用条件展开 `...(isTeamManager ? [...] : [])` 保留原可见性，避免越权展示。
2. **空分组过滤**：`member` 角色下「系统设置」分组无任何可访问项，需 `.filter((s) => s.items.length > 0)` 避免渲染空标题分组。
3. **图标导入类型**：lucide-react 图标用 `LucideIcon` 类型标注，`<item.icon className=...>` 动态渲染；确认所用图标（Gauge/Server/Boxes 等）在安装版本中均存在。
4. **布局隔离**：侧边栏用 `fixed inset-y-0 w-64`，主内容区 `pl-64` 包裹 header + `main`，保证侧边栏不随内容滚动。

## 4. 验证结果

- `pnpm --filter portal-frontend typecheck`：通过。
- `pnpm --filter portal-frontend lint`：0 errors（4 条 warning 均为预存，与本次改动无关）。
- `pnpm --filter portal-frontend build`：通过。

## 5. 关联

- feature：`docs/feature/portal_ui.md`
- 规范：`docs/rules/UI.md`
- 上游讨论：`docs/issue/菜单优化.md`
