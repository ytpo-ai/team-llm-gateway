# OFFICIAL_API A-02/P-01 开发记录（OAuth 缓存可插拔 + 预置目录远程拉取）

> 对应计划：`docs/plan/OFFICIAL_API_ADVANCED_PLAN.md`（A-02）、`docs/plan/OFFICIAL_API_PRESET_PLAN.md`（P-01）
> 分支：`main`

## 1. 实现摘要

- **A-02（OAuth token 缓存可插拔）**：将 `gemini-oauth.ts` 的模块级 `Map` 缓存重构为可插拔 `TokenCache` 接口 —— `MemoryTokenCache`（默认，单机）+ `RedisTokenCache`（配置 `REDIS_URL` 时动态加载 `ioredis`，多实例共享）。`getTokenCache()` 单例按环境变量懒初始化。
- **P-01（预置目录远程拉取）**：官方预置目录从前端静态常量迁移到后端 `GET /models/presets`；`ModelsService.getOfficialPresets()` 配置 `MODEL_PRESETS_URL` 时远程拉取（内存缓存 1h）+ 失败回退静态目录。前端改为拉取后端接口，删除 `features/models/presets.ts`。

## 2. 代码改动点

### 后端

| 文件 | 说明 |
|---|---|
| `modules/proxy/adapters/token-cache.ts` | `TokenCache` 接口 + `MemoryTokenCache` + `RedisTokenCache` + `getTokenCache`/`clearTokenCache` |
| `modules/proxy/adapters/gemini-oauth.ts` | 改用 `getTokenCache()`，token 缓存逻辑外移 |
| `modules/models/official-presets.ts` | 预置目录静态常量（后端托管） |
| `config/configuration.ts` | 新增 `modelPresets.url`（`MODEL_PRESETS_URL`） |
| `modules/models/models.service.ts` | 注入 `ConfigService`，新增 `getOfficialPresets()` |
| `modules/models/models.controller.ts` | 新增 `GET /models/presets`（声明在 `:id` 之前） |
| `modules/proxy/adapters/token-cache.spec.ts` | 内存缓存单测（3 例） |
| `modules/models/models.service.spec.ts` | 预置目录单测（3 例） |

### 前端

| 文件 | 说明 |
|---|---|
| `features/models/types.ts` | 新增 `OfficialModelPreset`/`OfficialProviderPreset` |
| `features/models/api.ts` | 新增 `listOfficialPresets()` |
| `pages/models.tsx` | 预置目录改走后端 `GET /models/presets` |
| `features/models/presets.ts` | 删除（已后端托管） |

### 配置

- `.env.example` 新增 `REDIS_URL`、`MODEL_PRESETS_URL`。

## 3. 踩坑记录

1. **ioredis 类型**：ioredis v6 的 `Redis` 是「class + interface」声明合并，需用命名导入 `import { Redis } from 'ioredis'`（默认导入会解析为 namespace 报 TS2709）。Redis 缓存配置 `maxRetriesPerRequest: 1` + `enableOfflineQueue: false`，宕机时快速失败，`getAccessToken` 内 try/catch 降级为直接换 token。
2. **Nest 路由顺序**：`GET /models/presets` 必须声明在 `GET /models/:id` 之前，否则 `presets` 会被当作 `:id` 匹配。

## 4. 验证结果

- 后端：lint 0/0、typecheck 通过、build 通过、test 125 passed。
- 前端：typecheck/build 通过。

## 5. 关联

- 计划：`docs/plan/OFFICIAL_API_ADVANCED_PLAN.md`、`docs/plan/OFFICIAL_API_PRESET_PLAN.md`
- 待决：A-01（远程图片 SSRF 白名单）仍未实现。
