# team-llm-gateway

面向小型产研/办公团队的 AI 接入服务网关（团队接入平台）：团队/成员/APIKey 管理、细粒度计量、模型选型建议。

## 产品矩阵

| 组件 | 仓库 | 定位 |
|---|---|---|
| **team-llm-gateway**（团队接入网关） | 本仓库 `apps/portal-backend` + `apps/portal-frontend` | 团队/成员/APIKey + 细粒度计量 + 选型建议；上游统一 OpenAI 兼容抽象，可直连官方 / 第三方中转 / 自有 proxy |
| **team-llm-proxy**（LLM 中转代理） | 独立仓库（后续，基于 new-api 内核） | 模型接入 + 流量池 + 路由 + 客户级计量；**gateway 的首选上游（默认走 proxy，可旁路）** |
| 超级 Portal（SaaS） | 同一套代码的多租户形态 | 服务商全局视角 + 计费 |

> 架构决策见 `docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-01~12）。
> 开发优先级：**team-llm-gateway（团队接入网关）优先**（ADR-12）。

## 目录结构

```
.
├── apps/
│   ├── portal-backend/    # Nest.js + TypeScript + MongoDB
│   └── portal-frontend/   # React + TS + Tailwind + shadcn/ui
├── docs/                  # 项目文档（feature/plan/requirement/technical/guide...）
├── forks/                 # 参考仓库（new-api / litellm / portkey-gateway，不纳入版本库）
├── package.json           # pnpm workspace + turbo 根编排
└── pnpm-workspace.yaml
```

## 技术栈

- 仓库：pnpm workspace + turbo 单仓
- 后端：Nest.js + TypeScript(strict) + Mongoose(MongoDB) + class-validator + Swagger
- 前端：React 19 + TypeScript + Tailwind CSS + shadcn/ui + Vite + React Router + TanStack Query
- 测试：后端 Vitest + supertest；前端 oxlint + tsc

## 快速开始

前置：Node.js ≥ 22、pnpm ≥ 10、MongoDB。

```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

pnpm install            # 安装依赖
cp apps/portal-backend/.env.example apps/portal-backend/.env  # 配置后端环境

pnpm dev                # 同时启动前后端（turbo）
# 或分别启动：
#   pnpm --filter portal-backend start:dev
#   pnpm --filter portal-frontend dev
```

- 后端：http://127.0.0.1:3000（`/health` 健康检查，`/api/docs` Swagger）
- 前端：http://127.0.0.1:5173

## 常用脚本

```bash
pnpm lint          # 全仓 lint（oxlint）
pnpm typecheck     # 全仓类型检查
pnpm build         # 全仓构建
pnpm test          # 全仓测试
```

## 文档

- 目标规划：`docs/TARGET.md`
- 架构定位：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`
- 参考调研：`docs/technical/LLM_API_GATEWAY_COMPARISON.MD`
- 功能索引：`docs/feature/INDEX.md`
- 开发协议：`AGENTS.md`

## 开源协议

本项目基于 [MIT 许可证](./LICENSE) 开源，可自由使用、修改与分发（含商用）。

参与贡献前请阅读 [贡献指南](./CONTRIBUTING.md)。
