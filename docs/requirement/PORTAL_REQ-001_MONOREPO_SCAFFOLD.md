# PORTAL_REQ-001 Monorepo 骨架与工程基线

## 1. 基本信息

| 项 | 值 |
|---|---|
| 所属 feature | `docs/feature/INDEX.md`（工程基础，跨模块） |
| 所属 plan | `docs/plan/PORTAL_FOUNDATION_PLAN.md` |
| 需求管理 ID | — |
| 分支 | `feat/portal-monorepo-scaffold` |
| 状态 | `draft` |

## 2. 需求描述

### 背景
Portal 从零开始，需先建立 pnpm workspace + turbo 单仓骨架，为后端/前端开发提供统一工程基线。

### 目标
- 根目录 `pnpm-workspace.yaml`、`turbo.json`、根 `package.json`（含 lint/typecheck/build/test 编排脚本）。
- `apps/portal-backend`、`apps/portal-frontend` 目录就绪。
- `.gitignore`（含 `forks/`、`.worktrees/`、`.env`）、`.gitattributes`、`.npmrc`。
- `README.md` 基础说明。

### 验收条件
- [ ] `pnpm install` 成功，无 workspace 冲突。
- [ ] `pnpm lint` / `pnpm typecheck` 在双 app 各自可通过（骨架阶段允许空实现）。
- [ ] `forks/` 与 `.worktrees/` 被 git 忽略，无嵌套 git 污染。

## 3. 技术方案摘要
- pnpm workspace + turbo 单仓；双 app 各自独立 `package.json`/`tsconfig`，共享根 lint 规则。
- 参考 `docs/plan/PORTAL_FOUNDATION_PLAN.md` §3。

## 4. 交付物与追溯

| 类型 | 文档 |
|---|---|
| development | `docs/development/PORTAL_REQ-001_DEVELOPMENT.md`（待补充） |
| fix | — |

## 5. 状态跟踪
- [ ] 开发中
- [ ] 待验收
- [ ] 已交付
