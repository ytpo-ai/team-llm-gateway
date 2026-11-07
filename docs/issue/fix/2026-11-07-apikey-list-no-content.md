# 修复：API Key 列表页不展示内容

> 关联 feature：`docs/feature/api_keys.md`
> 修复日期：2026-11-07

## 1. 问题现象

API Key 列表页（`/api-keys`）始终显示无内容 — 即使数据库中存在 API Key 记录，页面也只展示「暂无 API Key，点击右上角创建。」或空白。

## 2. 根因分析

### 2.1 后端：system 角色未视为管理员，列表查询按成员过滤

**核心根因**。`apps/portal-backend/src/modules/api-keys/api-keys.service.ts` 的 `list()` 与 `findAccessibleKey()` 仅对 `Role.TEAM_ADMIN` 做管理员判断，**遗漏了 `Role.SYSTEM`**：

```typescript
// 修复前：system 用户走 else 分支 → 按 userId: systemAdminId 过滤 → 查不到其他成员的 Key
const filter =
  user.role === Role.TEAM_ADMIN
    ? { tenantId: user.tenantId, teamId: user.teamId }
    : { tenantId: user.tenantId, userId: user.id };  // ← system 命中这里，永远返回空
```

JWT strategy 虽然能通过 `X-Tenant-Id` 头为 system 用户正确切换 `tenantId` / `teamId`，但 service 层不认 `SYSTEM` 角色，导致：

1. `list()`：system 用户按 `userId: 自己的ID` 查询，只能看到自己的 Key（通常为 0 条）
2. `findAccessibleKey()`：system 用户对团队内其他成员的 Key 操作返回 403

注意：Controller 层的 `@Roles(Role.TEAM_ADMIN)` 不受影响，因为 `RolesGuard` 采用 rank 制（`SYSTEM: 3 ≥ TEAM_ADMIN: 2`），system 可自动通过。

### 2.2 前端：缺少查询错误处理（掩盖问题）

`apps/portal-frontend/src/pages/api-keys.tsx` 仅处理 `isLoading` 和空数据两种状态，缺失 `isError` 分支。当查询返回空数组时（而非显式的 HTTP 错误），页面静默展示空状态，用户无法判断是"真的没有 Key"还是"查询条件受限"。

## 3. 修复动作

### 后端（`apps/portal-backend/src/modules/api-keys/`）

- `api-keys.service.ts`：引入 `isManager`（`TEAM_ADMIN || SYSTEM`），用于 `list()` 的 filter 构建和 `findAccessibleKey()` 的权限判断。
- `api-keys.service.spec.ts`：新增 2 个 system 角色测试用例：
  - `list` → system 用户应按 `{ tenantId, teamId }` 查询团队所有 Key
  - `get` → system 用户可访问团队内其他成员的 Key

### 前端（`apps/portal-frontend/src/pages/api-keys.tsx`）

- 在 `isLoading` 与空数据之间插入 `isError` 分支，展示 `ApiError` 消息与「重试」按钮（`keysQuery.refetch()`）。

## 4. 验证结果

- [x] 后端：system 用户调用 `GET /api-keys` 返回团队所有 Key（非空）
- [x] 后端：system 用户可操作团队内其他成员的 Key（get / update / revoke / rotate）
- [x] 后端测试：12/12 通过（新增 2 个 system 角色用例）
- [x] 前端：API 异常时展示错误消息 + 重试按钮
- [x] 前端 `npx tsc -b --noEmit` 通过
- [x] 提交：`5aee6e7` — 前端错误处理；`<TBD>` — 后端权限修复