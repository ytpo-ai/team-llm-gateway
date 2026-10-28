# Portal 平台基础工程搭建计划（PORTAL_FOUNDATION）

> 本 plan 固化 Portal 的**功能清单**与**技术选型**，并完成文档体系与工程骨架的初始化，作为后续功能开发的起点。
>
> - 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-01~12、§5.2、§6、§7、§8、§10）
> - 定稿时间：2026-10-28
> - 状态：已批准

---

## 1. 需求背景

Portal 从零开始。产品矩阵中 Portal（团队接入平台）是差异化价值所在（模型选型建议、团队细粒度计量、Token 优化），是产品护城河（ADR-12）。在开始业务功能开发前，需先锚定 Portal 的功能清单与技术选型，并搭建可运行的工程骨架与文档体系。

## 2. 目标

1. 定稿 Portal 功能清单（9 大模块，多租户内建）。
2. 定稿技术选型（在 ADR-04/§6 基础上补齐工程细节）。
3. 建立文档体系（feature/plan/requirement 目录 + 9 个 feature 骨架 + 需求追溯表）。
4. 初始化 monorepo 骨架（pnpm workspace + turbo + backend/frontend 脚手架），跑通 lint/typecheck/test 基线。

## 3. 技术选型（定稿）

| 层 | 选型 | 说明 |
|---|---|---|
| 仓库 | pnpm workspace + **turbo** 单仓 | `apps/portal-backend` + `apps/portal-frontend` + `packages/*` |
| 后端 | Nest.js + TypeScript(strict) + Mongoose(MongoDB) | ADR-04/§6 |
| 后端校验/文档 | class-validator + @nestjs/swagger(OpenAPI) | Nest 标准 |
| 认证 | JWT(access+refresh) + Passport；预留 OIDC/OAuth | 首期本地账号 |
| 前端 | React 19 + TS + Tailwind CSS + **shadcn/ui** | ADR-04/§6 |
| 前端工程 | Vite + React Router + TanStack Query + Zustand | 状态/路由/服务端数据 |
| 测试 | 后端 Jest+supertest；前端 Vitest+Testing Library | — |
| 计量存储 | 初期 MongoDB 聚合，量大后再引 ClickHouse/时序库 | 降低初期运维 |
| 部署 | Docker | — |

## 4. 功能清单（9 大模块）

> 详见各 `docs/feature/<module>.md`，此处为索引。多租户内建于核心（ADR-03），单团队开源版 = 租户数=1 的特例，隐藏服务商/系统角色。

| 模块 | feature 文档 | 职责 |
|---|---|---|
| 租户与认证 | `docs/feature/tenant_auth.md` | 租户、认证、RBAC |
| 团队与成员 | `docs/feature/team_member.md` | 团队→成员→角色→成员额度 |
| API Key 管理 | `docs/feature/api_key.md` | key 签发 + 细粒度限制 + 用量归属 |
| 模型与上游 | `docs/feature/model_provider.md` | 上游接入（OpenAI 兼容抽象）+ 模型目录/倍率/能力标签 |
| 计量与用量 | `docs/feature/usage_metering.md` | token 计量 + 三级聚合 + 可视化 |
| 计费与额度 | `docs/feature/billing_quota.md` | 统一扣费引擎 + 可插拔额度来源 |
| 模型选型建议 | `docs/feature/model_recommendation.md` | 差异化能力（D-02） |
| 服务商全局视角 | `docs/feature/admin_overview.md` | 多租户管理 + 全局看板（仅 SaaS） |
| 系统管理 | `docs/feature/system_admin.md` | 配置/审计/通知 |

## 5. Requirement 拆解（首发）

本 plan 拆解 3 个可独立验收的 requirement（工程基础层）：

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [PORTAL_REQ-001](../requirement/PORTAL_REQ-001_MONOREPO_SCAFFOLD.md) | monorepo 骨架 + 工程基线 | `pnpm install` + `pnpm lint`/`typecheck` 通过，双 app 目录就绪 |
| [PORTAL_REQ-002](../requirement/PORTAL_REQ-002_BACKEND_BASE.md) | 后端 Nest 基础框架 | `pnpm --filter backend start:dev` 启动，health 接口返回 200，Mongo 连通、Swagger 可访问 |
| [PORTAL_REQ-003](../requirement/PORTAL_REQ-003_FRONTEND_BASE.md) | 前端基础框架 | `pnpm --filter frontend dev` 启动 + `build` 通过，路由/布局/主题/登录页骨架就绪 |

> 后续功能模块（认证/团队/APIKey/上游/计量/计费/选型建议）将按依赖顺序拆为独立 plan，逐层交付。

## 6. 里程碑

1. ✅ 功能清单 + 技术选型定稿（本文档）。
2. ✅ 文档体系 + feature 骨架（本 plan）。
3. ✅ monorepo 骨架 + 工程基线（REQ-001）。
4. ✅ 后端基础框架（REQ-002）。
5. ✅ 前端基础框架（REQ-003）。
6. 🔄 功能模块逐步开发（tenant_auth 进行中 → team_member → api_key → model_provider → usage_metering → billing_quota → model_recommendation）。

## 7. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| D-02 | 选型建议详细设计（首期静态推荐） | 已给出初步建议，待展开 |
| D-03 | 计费模式首发清单（充值/月结/赠送） | 已给出初步建议，待展开 |
| D-04 | 多租户隔离细节（tenantId 共享库） | 已给出初步建议，待展开 |
| D-05 | 接口契约细化（OpenAI 兼容上游 + REST 管理 API） | 已给出初步建议，待展开 |
| R-01 | `forks/` 参考仓库需 gitignore，避免嵌套 git | 本 plan 处理 |
| R-02 | 前端 UI 组件库 shadcn/ui 采用默认，用户未明确选择 | 已按默认采纳，可随时调整 |

## 8. 关联

- 上游：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`、`GATEWAY_NEWAPI_FEATURE_CUT.MD`
- feature：`docs/feature/INDEX.md` 及 9 个模块文档
- requirement：见 §5
