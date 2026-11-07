# 修复：API Key 列表页查询失败时静默显示空状态，不展示错误信息

> 关联 feature：`docs/feature/api_keys.md`
> 修复日期：2026-11-07

## 1. 问题现象

API Key 列表页（`/api-keys`）在接口请求失败时（401 认证失败、500 服务端错误、网络中断等），页面不展示任何错误提示，而是静默显示「暂无 API Key，点击右上角创建。」，用户无法区分「真的没有 Key」和「请求出错」。

## 2. 根因分析

`apps/portal-frontend/src/pages/api-keys.tsx` 中仅处理了 `keysQuery.isLoading`（加载中）和 `keysQuery.data` 为空（空数据）两种状态，**缺失 `keysQuery.isError` 状态处理**：

```tsx
{keysQuery.isLoading ? (
  <div>加载中…</div>
) : keys.length === 0 ? (
  <div>暂无 API Key，点击右上角创建。</div>
) : (
  <table>...</table>
)}
```

当 `useQuery` 请求失败后（默认重试 3 次后进入 error 态）：
- `isLoading` → `false`
- `data` → `undefined`
- `keys` → `[]`（空数组）
- 页面进入「空数据」分支，用户体验为列表无内容

同理，页面中的 `policySetsQuery`、`teamsQuery`、`membersQuery` 也缺少错误处理，policy 集合、成员列表在出错时同样静默降级为空数组。

## 3. 修复动作

### 前端（`apps/portal-frontend/src/pages/api-keys.tsx`）

1. **主列表 `keysQuery`**：在 `isLoading` 和空数据之间插入 `isError` 分支，展示错误消息与重试按钮。
2. **`policySetsQuery`**：增加 `isError` 判断，出错时逻辑上视为策略集列表为空（逻辑降级，不影响主功能），但不再静默吞错。
3. **`teamsQuery` / `membersQuery`**：同上，出错时成员列表为空，不影响主列表渲染。

## 4. 验证结果

- [x] API 返回 401 / 500 时，列表区域展示错误信息与「重试」按钮，不再显示误导性空状态
- [x] 正常请求成功时，列表渲染不变
- [x] `npm run typecheck` 通过