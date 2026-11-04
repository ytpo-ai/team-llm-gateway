# 开源贡献指南

感谢你关注 **team-llm-gateway**（面向小型产研/办公团队的 AI 接入服务网关）。

本项目采用 [MIT 许可证](./LICENSE) 开源，欢迎提交 Issue、Pull Request 与讨论。以下是参与贡献的基本约定。

## 一、如何参与

1. **提 Issue**：反馈 Bug、提出功能建议、讨论设计问题，请先搜索是否已有相同议题。
2. **提 Pull Request**：
   - Fork 本仓库并创建独立分支（如 `feat/xxx`、`fix/xxx`）。
   - 保持改动聚焦单一主题，避免无关改动混入。
   - 补充或更新相关测试与文档。
3. **讨论**：架构与需求层面的问题，欢迎先在 Issue 中讨论再动手实现。

## 二、开发环境

前置依赖：Node.js ≥ 22、pnpm ≥ 10、MongoDB。

```bash
pnpm install            # 安装依赖
cp apps/portal-backend/.env.example apps/portal-backend/.env  # 配置后端环境
pnpm dev                # 同时启动前后端（turbo）
```

## 三、提交前检查

```bash
pnpm lint          # 全仓 lint（oxlint）
pnpm typecheck     # 全仓类型检查
pnpm build         # 全仓构建
pnpm test          # 全仓测试
```

请确保以上检查全部通过后再提交。

## 四、Commit 规范

提交信息采用 Conventional Commits 风格：

```
<type>(<scope>): <subject>
```

- `type`：`feat` / `fix` / `docs` / `style` / `refactor` / `test` / `chore`
- `scope`（可选）：`backend` / `frontend` / `api` / `db` / `auth` / `config`

示例：`feat(api): 新增模型选型建议接口`

## 五、代码风格

- TypeScript 严格模式
- 后端使用 Nest.js 装饰器风格
- 前端使用函数式组件 + React Hooks
- 命名：组件 PascalCase，函数/变量 camelCase，常量 UPPER_SNAKE_CASE，文件 kebab-case

## 六、安全约定

- 不提交 `.env` 文件或任何包含密钥的文件
- API Key、数据库密码、JWT secret 等一律使用环境变量
- 提交前检查是否包含敏感信息（`sk-*`、`pk_*` 等）

## 七、许可证

所有贡献均以 [MIT 许可证](./LICENSE) 发布。提交代码即表示你同意你的贡献在该许可证下分发。
