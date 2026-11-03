# OFFICIAL_API A-01 开发记录（vision 远程图片 SSRF 防护）

> 对应计划：`docs/plan/OFFICIAL_API_ADVANCED_PLAN.md`（A-01）
> 分支：`main`

## 1. 实现摘要

为 Anthropic vision 的远程图片拉取增加 SSRF 防护：新增 `ssrf-guard.ts`，在 `convertImageUrl` 拉取远程 URL 前先解析主机名、校验其解析 IP 是否公网，拦截内网/回环/链路本地/云元数据等地址。

- `isPrivateIp(ip)`：基于 `node:net` `isIP` 判定 IPv4/IPv6，逐一匹配私有/保留网段（RFC1918、loopback、link-local、CGNAT、组播、保留段、`fc00::/7`、`fe80::/10`、`::1` 等）；无法识别视为私有（保守拦截）。
- `isPublicHostname(hostname)`：`dns.lookup({all:true})` 解析全部地址，要求**所有**地址均为公网。
- `isSafeImageUrl(url)`：仅 `http(s)` 协议 + 主机名公网校验。
- `convertImageUrl`：远程 URL 先过 `isSafeImageUrl`，不通过则丢弃该内容块（返回 `undefined`）。

## 2. 代码改动点

| 文件 | 说明 |
|---|---|
| `modules/proxy/adapters/ssrf-guard.ts` | SSRF 校验工具（`isPrivateIp`/`isPublicHostname`/`isSafeImageUrl`） |
| `modules/proxy/adapters/anthropic.adapter.ts` | `convertImageUrl` 接入 `isSafeImageUrl` |
| `modules/proxy/adapters/ssrf-guard.spec.ts` | 单测（9 例） |

## 3. 踩坑记录

1. **DNS 重绑定**：`dns.lookup` 校验通过后 `fetch` 仍可能重新解析到不同 IP，属已知边界；首期采用「解析即校验」的第一层防护，完整防护需 IP 固定连接（自定义 dispatcher），成本高暂不引入。

## 4. 验证结果

- 后端：lint 0/0、typecheck 通过、build 通过、test 134 passed（含 ssrf-guard 9 例）。

## 5. 关联

- 计划：`docs/plan/OFFICIAL_API_ADVANCED_PLAN.md`
