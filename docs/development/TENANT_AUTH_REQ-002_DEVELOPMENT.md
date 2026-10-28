# TENANT_AUTH_REQ-002 开发记录（前端认证闭环）

> 对应需求：`docs/requirement/TENANT_AUTH_REQ-002_FRONTEND_AUTH.md`
> 对应计划：`docs/plan/TENANT_AUTH_PLAN.md`
> 分支：`feat/tenant-auth-frontend`（提交 `8cd9f79`）

## 1. 实现摘要

将前端登录页从「纯静态骨架」落地为完整认证闭环，对接后端 REQ-001 的 `register`/`login`/`refresh`/`profile` 接口：

- 认证 API 层：`fetch` 封装（自动注入 Bearer、401 时用 refresh 续期并重试一次、错误解析）。
- 认证状态：Zustand + `persist`，access/refresh/user 持久化到 localStorage。
- 路由守卫：`ProtectedRoute`，未登录跳转 `/login`，已登录访问 `/login` 跳回 `/`。
- 登录/初始化页：登录 + 初始化注册双模式，含错误提示与 loading。
- 布局接入当前用户与退出登录。
- Vite `/api` 代理到后端，启动时校验已存 token（失效自动登出）。

## 2. 代码改动点

### 新增

| 文件 | 说明 |
|---|---|
| `src/lib/http.ts` | `request<T>()` 封装：BASE_URL（`/api` 默认）+ `ApiError` + 401 自动 refresh 重试 |
| `src/features/auth/types.ts` | `Role` / `User` / `AuthResponse` / `TokenPair` / `LoginInput` / `RegisterInput` |
| `src/features/auth/api.ts` | `login` / `register` / `refresh` / `getProfile` |
| `src/features/auth/store.ts` | `useAuthStore`（persist `portal-auth`）：`login`/`register`/`logout`/`refreshAccessToken`/`fetchProfile` |
| `src/features/auth/protected-route.tsx` | 路由守卫组件 |
| `src/vite-env.d.ts` | `ImportMetaEnv.VITE_API_BASE_URL` 类型声明 |

### 修改

| 文件 | 说明 |
|---|---|
| `src/pages/login.tsx` | 重写为登录/初始化双模式表单 |
| `src/router.tsx` | 受保护路由包 `ProtectedRoute` |
| `src/components/layout/app-layout.tsx` | 显示当前用户 + 退出登录按钮 |
| `src/main.tsx` | 启动时若有 token 则 `fetchProfile()` 校验 |
| `vite.config.ts` | `server.proxy['/api']` → `http://127.0.0.1:3000`（rewrite 去掉 `/api`） |

## 3. 踩坑记录

1. **Vite 默认绑定 localhost（::1）**：`curl 127.0.0.1:5173` 连不上（status 000），改用 `localhost` 验证代理正常。属环境差异，非代码缺陷。
2. **本地 27017 Mongo 开启鉴权**：与 REQ-001 一致，`Command find requires authentication`；冒烟改用临时无鉴权 Mongo 容器（端口 27018）完成。

## 4. 验证结果

- `pnpm --filter portal-frontend lint`：0 errors（1 条 theme-provider 既有 warning，非本次改动）。
- `pnpm --filter portal-frontend typecheck`：通过。
- `pnpm --filter portal-frontend build`：通过（2025 modules，gzip 119.5 kB）。
- 后端契约冒烟（临时 Mongo，端口 27018）：
  - `register` → 200，返回 `{ user, accessToken, refreshToken }`，`user.role=team_admin`。
  - `login` → 200；错误密码 → 401。
  - `profile`（带 access）→ 200 返回当前用户；无 token → 401。
  - `refresh` → 200 换取新 access/refresh。
- Vite 代理冒烟：`POST localhost:5173/api/auth/login` → 401（转发成功），`GET /api/health` → `{ status: ok, mongo: up }`。

## 5. 关联

- feature：`docs/feature/tenant_auth.md`
- 后端契约：REQ-001（`docs/development/TENANT_AUTH_REQ-001_DEVELOPMENT.md`）
- 待决事项：R-01（refresh 轮换/吊销）见 `docs/plan/TENANT_AUTH_PLAN.md` §6。
