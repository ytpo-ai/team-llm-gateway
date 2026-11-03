# 功能模块索引

> Portal 功能模块全景。每个模块对应一个 feature 文档，遵循 `docs/rules/FEATURE.md`。
>
> - 上游定位：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`
> - 追溯：feature → plan → requirement → development/fix

## 1级模块列表

| 模块 | 文档 | 形态 | 说明 |
|---|---|---|---|
| 租户与认证 | [tenant_auth](tenant_auth.md) | 单团队/SaaS 共用 | 租户、认证、RBAC |
| 团队与成员 | [team_member](team_member.md) | 单团队/SaaS 共用 | 团队→成员→角色→成员额度 |
| API Key 管理 | [api_key](api_key.md) | 单团队/SaaS 共用 | key 签发 + 细粒度限制 + 用量归属 |
| 模型与上游 | [model_provider](model_provider.md) | 单团队/SaaS 共用 | 上游接入 + 模型目录/倍率/能力标签 |
| 计量与用量 | [usage_metering](usage_metering.md) | 单团队/SaaS 共用 | token 计量 + 三级聚合 + 可视化 |
| 计费与额度 | [billing_quota](billing_quota.md) | 单团队/SaaS 共用 | 统一扣费引擎 + 可插拔额度来源 |
| 模型选型建议 | [model_recommendation](model_recommendation.md) | 单团队/SaaS 共用 | 差异化能力 |
| 服务商全局视角 | [admin_overview](admin_overview.md) | 仅 SaaS | 多租户管理 + 全局看板 |
| 系统管理 | [system_admin](system_admin.md) | 单团队/SaaS 共用 | 配置/审计/通知 |
| 前端 UI 工程 | [portal_ui](portal_ui.md) | 单团队/SaaS 共用 | UI 基础原语与交互规范落地 |

## 说明

- **多租户内建**（ADR-03）：所有模块按多租户设计，单团队开源版 = 租户数=1 的特例。
- **服务商全局视角（admin_overview）** 与 **系统管理（system_admin）** 中的服务商/系统角色，在开源单团队版中隐藏。
