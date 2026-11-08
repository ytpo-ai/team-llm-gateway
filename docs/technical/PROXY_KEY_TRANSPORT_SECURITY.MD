# 中转核心跨进程密钥安全（待讨论）

> 状态：**待讨论（独立议题，当前实现暂缓）**
> 起草时间：2026-11-07
> 关联：`PROXY_POLICY_PROTOCOL.MD`（P-03）
> 触发时机：路径 2「中转服务提炼成独立标准服务」落地前**必须**解决

---

## 0. 背景

`StandardRequest.Candidate.apiKey` 是 Resolver 已解密的上游密钥。

当前实现为**进程内**（Resolver 与 ProxyCore 同进程，直接内存传递），不存在跨进程传输，无安全问题。

当路径 2 落地、ProxyCore 独立成服务后，`Candidate` 需跨进程传输，`apiKey` 如何保护成为问题。

## 1. 问题本质

转发上游必然要用到密钥，本质是「**密钥暴露半径**」的取舍：

| 方案 | 做法 | 密钥暴露半径 | 代价 |
|---|---|---|---|
| A. 传输加密 | Resolver↔ProxyCore 走 mTLS，`apiKey` 明文进 `Candidate` | 扩大到 ProxyCore 进程 | 简单，但核心被攻破即泄露 |
| B. 密钥引用 | `Candidate` 只传 `apiKeyRef`，核心按引用向密钥服务取 | 收在密钥服务 | 破坏「自包含无状态」，多一次 RPC |
| C. 预签名 | Resolver 侧直接构造上游 `Authorization` 头，核心不碰密钥 | 收在 Portal（最小） | 每个候选渠道要预构造；与上游协议耦合 |

## 2. 当前决策（暂缓）

- 当前实现以**最简方式**完成协议：进程内 `apiKey` 直接进 `Candidate`，不做密钥保护。
- P-03 留待路径 2 落地前单独讨论，届时在 `Candidate.apiKey` 处替换为 `apiKeyRef` 或 `signedAuth`。

## 3. 待讨论要点

（待后续讨论时补充：部署形态、信任边界、是否跨公网等。）
