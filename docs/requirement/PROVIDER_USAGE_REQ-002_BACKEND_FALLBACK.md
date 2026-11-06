# REQ-002：转发层多渠道自动 Fallback

> 关联 Plan：`docs/plan/PROVIDER_USAGE_SENSE_PLAN.md`
> 状态：✅ 已完成
> 开发记录：`docs/development/PROVIDER_USAGE_REQ-001_DEVELOPMENT.md`

## 验收条件

- [x] `ProxyService.getProviderCandidates()` 按 `providerBindings.priority` 升序排列候选渠道
- [x] `tryCandidate()` 检查渠道 active / policy 允许 / isExhausted 后返回 PreparedRequest
- [x] 四入口（chatCompletions / streamChatCompletions / messages / streamMessages）均支持 fallback loop
- [x] 429 响应自动 `markExhausted()` + 切换下一候选
- [x] 5xx / 408 服务端错误自动切换下一候选
- [x] 上游响应头速率信息提取（x-ratelimit-*）
- [x] 全部候选耗尽返回 502
- [x] lint / typecheck / test 通过

## 代码位置

- `apps/portal-backend/src/modules/proxy/proxy.service.ts`