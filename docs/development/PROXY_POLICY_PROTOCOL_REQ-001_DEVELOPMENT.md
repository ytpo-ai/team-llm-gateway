# PROXY_POLICY_PROTOCOL 开发总结

> 对应 Plan：`docs/plan/PROXY_POLICY_PROTOCOL_PLAN.md`
> 分支：`main`
> 开发时间：2026-11-08

## 1. 交付内容

| Requirement | 状态 | 说明 |
|---|---|---|
| REQ-001 协议类型 + PolicyResolver | ✅ 已完成 | 协议类型文件、PolicyResolver 服务及其单测（16 cases） |
| REQ-002 ProxyCore 重构 + MeterBackend | ✅ 已完成 | MeterBackend 接口 + RedisMeterBackend、ProxyService 重构、回归测试更新 |

## 2. 新增文件

| 文件 | 用途 |
|---|---|
| `proxy/protocol/types.ts` | 纯协议类型：`Measure`/`Window`/`Action` 枚举，`StandardPolicy`/`StandardState`/`StandardLimit`/`StandardRequest`/`Candidate`/`StandardResult` 接口，零 Nest/Mongoose 依赖 |
| `proxy/policy-resolver.service.ts` | 策略解析器：三级策略合并 → `StandardPolicy`（states + allowlists + limits）+ `Candidate[]` |
| `proxy/policy-resolver.service.spec.ts` | PolicyResolver 单测（16 cases）：状态求值、白名单交集、限额扁平化、余额/模型/Key 状态、Candidate 构建与过滤 |
| `proxy/meter-backend.interface.ts` | `MeterBackend` 接口：`checkLimit`/`increment`/`acquireConcurrency` + `METER_BACKEND_TOKEN` |
| `proxy/redis-meter-backend.ts` | `RedisMeterBackend`（ioredis）：窗口计数（INCR + EXPIRE）、并发 Lua 原子获取/释放 |

## 3. 修改文件

| 文件 | 改动要点 |
|---|---|
| `proxy/proxy.service.ts` | 重构：注入 `PolicyResolver` + `MeterBackend`；统一 `process()` 方法消费 `StandardRequest`/产出 `StandardResult`；三层判定 → fallback → 转发 → 计量；移除 `RateLimitService`/`ConcurrencyService` 依赖 |
| `proxy/proxy.service.spec.ts` | 适配新依赖：Mock `PolicyResolver` + `MeterBackend` 替代旧 `QuotaLimitService`/`RateLimitService`/`ConcurrencyService`；回归场景保持（流式/非流式、429/5xx fallback、限额拦截、并发控制） |
| `proxy/proxy.module.ts` | 注册 PolicyResolver、MeterBackend（Token 工厂，`REDIS_URL` 配置）；新增 PolicySet/RoleTemplate/Team/User schema 注册 |

## 4. 架构决策记录

| 编号 | 决策 | 实现 |
|---|---|---|
| DR-03 | 三层判定：状态集 → 白名单 → 策略集 | `assertPolicyStates()` + `PolicyResolver.buildAllowlists()` + `assertLimits()` |
| DR-04 | 三层边界 = 外部布尔 / 集合成员 / 量化限额 | 协议已区分 `StandardState` / `allowlists` / `StandardLimit` |
| DR-05 | 余额归状态集 `balance_ok` | `PolicyResolver.buildStates()` 中求值 |
| DR-06 | 模型禁用 → 状态集；渠道禁用 → candidates 过滤 | `model_active` 进 states；`isProviderAllowed` 过滤 candidate |
| DR-09 | 执行顺序：状态集 → 白名单 → 策略集 | `process()` 按序执行，fail-fast |
| DR-11 | ProxyCore 只依赖 Redis、不依赖 MongoDB | `ProxyService` 转发路径不再查 Model/Provider 文档；`MeterBackend` 独立 Redis |

## 5. 遗留项

- `listModels` 仍使用旧 `QuotaLimitService`（管理面 API，不影响转发面）
- `MemoryMeterBackend` 未实现（`REDIS_URL` 必须配置；后续可按需补充纯进程内回退）
- 上游响应 `buildPreparedRequest` 中的 `adapter.buildRequest` 闭包逻辑已验证兼容

## 6. 验证结果

```
typecheck: ✅ (tsc --noEmit)
lint:      ✅ (oxlint --type-aware)
test:      ✅ (252 tests / 27 files)
```