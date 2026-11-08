# 在 opencode 中接入 Gateway 网关

> 定位：Gateway 暴露 **OpenAI 兼容**转发接口（成员 key → Portal → 上游 key 转发），可作为 opencode 的**自定义 provider** 直接接入。本文说明如何把 Gateway 配成 opencode 的提供商、如何配置 apikey，以及常见坑。
>
> 关联：`docs/feature/model_provider.md`（§1 转发层 D-05）、`docs/feature/api_key.md`、代码 `apps/portal-backend/src/modules/proxy/`（转发层）、`.../api-keys/`（key 签发）。

---

## 1. 前提：Gateway 暴露的接口

Gateway 后端（Nest.js）在 `ProxyController` 上暴露了两个 OpenAI 兼容端点：

| 端点 | 方法 | 说明 |
|---|---|---|
| `/v1/models` | GET | 列出团队可用模型（`object: "list"` + `data[].id`） |
| `/v1/chat/completions` | POST | chat 转发，支持 `stream` SSE 流式 |

认证方式：标准 `Authorization: Bearer <成员 API Key>`（`ApiKeyAuthGuard`，key 经 sha256 落库比对）。

**baseURL 前缀因环境而异**（这是最容易踩的坑）：

| 环境 | OpenAI 兼容 baseURL |
|---|---|
| 本地开发 | `http://127.0.0.1:3000/v1` |
| 生产 | `https://<你的部署域名>/api/v1` |

> 生产环境后端挂在 `/api` 前缀下（`/api/v1/models` 返回 JSON；不带 `/api` 的 `/v1/models` 返回的是前端 SPA 的 HTML）。配置 opencode 时 **必须带 `/api`**。

---

## 2. 第一步：在 Portal 里创建成员 API Key

opencode 请求 Gateway 时用的是**成员 API Key**（不是上游渠道 key）。

1. 登录 Portal（本地 `http://127.0.0.1:5173` 或生产环境地址）。
2. 进入「API Key 管理」页（`pages/api-keys`）。
3. 新建 key，绑定归属成员（`team_admin` 可绑定本团队任意成员，`member` 绑定自己）。
4. 完整 key 值**仅创建时一次性展示**（形如 `pk_...`），请立即复制保存；落库后只存 sha256 哈希与 `pk_` 前缀，无法找回。

> 该 key 会受其绑定的策略集（模型/渠道白名单 + 速率/预算/并发）约束，转发层逐级校验。

---

## 3. 第二步：在 opencode 中配置自定义 provider

opencode 版本不同，配置键名不同：

- **v1**：`provider`（单数）+ `npm` + `options`
- **v2**：`providers`（复数）+ `package` + `settings`（本文以 v2 为准，桌面版 ≥ 2.x）

配置文件：全局 `~/.config/opencode/opencode.json`（或项目根 `opencode.json`）。

### 3.1 最小配置（openai-compatible）

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "providers": {
    "gateway": {
      "name": "Team Gateway",
      "package": "@opencode/ai/providers/openai-compatible",
      "settings": {
        "baseURL": "https://<你的部署域名>/api/v1",
        "apiKey": "pk_你的成员key"
      },
      "models": {
        "qwen-max": { "name": "qwen-max" }
      }
    }
  }
}
```

字段说明：

| 字段 | 含义 |
|---|---|
| `gateway` | provider ID，即模型引用前缀 `gateway/qwen-max` |
| `name` | 展示名 |
| `package` | 运行时包；OpenAI 兼容接口用 `@opencode/ai/providers/openai-compatible` |
| `settings.baseURL` | 网关端点（**含 `/api` 前缀**，不要带 `/chat/completions`） |
| `settings.apiKey` | 成员 API Key（见 §2） |
| `models` | 手动声明的模型，key 必须与 Portal 模型目录的 `modelId`（或 alias）完全一致 |

### 3.2 apikey 的三种放法

按安全性/便利性从高到低，任选其一：

**方式 A：直接写在配置里**（最简单，但明文落盘）

```jsonc
"settings": { "apiKey": "pk_你的成员key" }
```

**方式 B：引用环境变量**（推荐，避免硬编码）

```jsonc
"settings": {
  "baseURL": "https://<你的部署域名>/api/v1",
  "apiKey": "{env:GATEWAY_API_KEY}"
}
```

再注入环境变量。**桌面版从 Dock 启动，读不到 `~/.zshrc`**，须用 launchctl：

```bash
launchctl setenv GATEWAY_API_KEY "pk_你的成员key"
```

**方式 C：`env` 字段声明**（v2 专用，按声明顺序取第一个存在的变量）

```jsonc
"gateway": {
  "name": "Team Gateway",
  "env": ["GATEWAY_API_KEY"],
  "package": "@opencode/ai/providers/openai-compatible",
  "settings": { "baseURL": "https://<你的部署域名>/api/v1" },
  "models": { "qwen-max": { "name": "qwen-max" } }
}
```

> `/connect` 命令仅收录 models.dev 目录内的内置 provider，**自定义 gateway 不在列表里**，所以 apikey 只能走上面三种方式，不能靠 `/connect`。

---

## 4. 第三步：选择模型并使用

1. 保存配置后**退出重进 opencode**（配置非热加载）。
2. `/models` 里应出现 `Team Gateway` 下的 `qwen-max`。
3. 引用格式：`gateway/qwen-max`。

```jsonc
{ "model": "gateway/qwen-max" }
```

---

## 5. 关于模型列表（手动 vs 自动发现）

- opencode 对自定义 `openai-compatible` provider **不会自动拉取 `/v1/models`**，`models` 需手动声明；新增模型时要同步改配置。
- 需要自动发现时，可加 `opencode-models-discovery` 插件：

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["opencode-models-discovery@latest"],
  "providers": {
    "gateway": {
      "name": "Team Gateway",
      "env": ["GATEWAY_API_KEY"],
      "package": "@opencode/ai/providers/openai-compatible",
      "settings": {
        "baseURL": "https://<你的部署域名>/api/v1",
        "modelsDiscovery": { "enabled": true }
      }
    }
  }
}
```

---

## 6. 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| `401 缺少 API Key` | 请求没带 `Authorization: Bearer`，检查 apikey 是否注入成功 |
| `401 API Key 无效或已吊销` | key 已吊销/过期/不存在；去 Portal 重新签发（§2） |
| `/models` 里看不到 gateway | ① 未重启 opencode；② baseURL 少了 `/api` 前缀；③ `models` 的 key 与 Portal `modelId` 不一致 |
| 请求返回 HTML 而非 JSON | baseURL 用成了 `https://<你的部署域名>/v1`（命中前端 SPA），应改为 `https://<你的部署域名>/api/v1` |
| 桌面版环境变量不生效 | Dock 启动读不到 shell 配置，用 `launchctl setenv`（§3.2 方式 B） |

---

## 7. 相关文档

- 功能：`docs/feature/model_provider.md`、`docs/feature/api_key.md`
- 转发层代码：`apps/portal-backend/src/modules/proxy/`（`proxy.controller.ts` 定义 `/v1/models`、`/v1/chat/completions`）
- 鉴权：`apps/portal-backend/src/modules/proxy/guards/api-key-auth.guard.ts`
