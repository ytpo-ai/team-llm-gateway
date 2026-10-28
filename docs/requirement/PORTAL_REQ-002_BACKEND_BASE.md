# PORTAL_REQ-002 后端 Nest 基础框架

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/tenant_auth.md`（认证骨架）、`docs/feature/INDEX.md` |
| 所属 plan | `docs/plan/PORTAL_FOUNDATION_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/portal-backend-base` |
| 状态 | `draft` |

## 2. 需求描述

### 背景
建立 Nest 后端基础框架，作为所有业务模块的承载。

### 目标
- Nest 模块结构：`app.module` + `config`（环境配置）+ `common`（全局异常过滤器、校验管道、响应拦截器）。
- MongoDB(Mongoose) 连接 + 配置项。
- Swagger(OpenAPI) 接入。
- health 接口返回 200。
- JWT 认证骨架（`modules/auth/`，Passport + 策略占位，首期本地账号）。

### 验收条件
- [ ] `pnpm --filter backend start:dev` 启动成功。
- [ ] `GET /health` 返回 200。
- [ ] Swagger UI（`/api/docs`）可访问。
- [ ] Mongo 连接成功（无 Mongo 时优雅降级，不阻塞启动）。
- [ ] `pnpm --filter backend lint` / `typecheck` 通过。

## 3. 技术方案摘要
- Nest.js + TypeScript(strict) + Mongoose + class-validator + @nestjs/swagger + @nestjs/passport + @nestjs/jwt。
- 参考 `docs/plan/PORTAL_FOUNDATION_PLAN.md` §3。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/PORTAL_REQ-002_DEVELOPMENT.md`（待补充） |
| fix | — |

## 5. 状态跟踪
- [ ] 开发中
- [ ] 待验收
- [ ] 已交付
