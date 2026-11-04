# 修复：opencode 经 gateway 访问 DeepSeek 渠道返回 413 Payload Too Large

> 关联 feature：`docs/feature/usage_metering.md`（转发层）
> 修复日期：2026-11-04

## 1. 问题现象

opencode 直连 DeepSeek 官方 API 正常，但切换为 gateway 的 DeepSeek 渠道后，`POST /v1/chat/completions` 返回 `413 request entity too large`（Payload Too Large）。

## 2. 根因分析

1. **错误来源不是上游 DeepSeek，也不是 opencode**：直连 DeepSeek 正常，说明请求本身合法、上游接受该大小；错误发生在 gateway 自身。

2. **直接原因：Express 默认 JSON body 上限 100kb**。`apps/portal-backend/src/main.ts` 未配置任何 body parser 选项，`NestFactory.create(AppModule)` 走 Nest（Express 平台）默认的 `express.json()`，其 `limit` 默认值为 `100kb`。

3. **触发路径**：opencode 的 `chat/completions` 请求体较大（system prompt + 全部工具定义 + 上下文 + 文件内容，几百 KB 到几 MB 很常见），超过 100kb 后，请求在进入 `ProxyController` 之前就被 body-parser 拦截，返回 `413 request entity too large`（该文案为 body-parser 超限的标准 message）。

4. **证据**：
   - 全项目无 `useBodyParser` / `rawBody` / 自定义 body parser 配置；
   - `proxy.controller.ts` 的 `chatCompletions` / `messages` 均用 `@Body()` 解析 JSON，走默认 `express.json()`；
   - Nest 12.3.2 确认支持 `app.useBodyParser('json', { limit })`（`NestExpressApplication` 接口）。

## 3. 修复动作

### 后端（`apps/portal-backend/src/main.ts`）

- `NestFactory.create(AppModule)` → `NestFactory.create<NestExpressApplication>(AppModule)`。
- 新增 `app.useBodyParser('json', { limit: '50mb' })`，放宽 JSON 请求体上限，覆盖 LLM 转发场景。

## 4. 验证结果

- `pnpm --filter portal-backend typecheck`：通过。
- `pnpm --filter portal-backend lint`：通过。

## 5. 关联

- 代码：`apps/portal-backend/src/main.ts`
