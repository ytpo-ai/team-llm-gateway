# 计费货币汇率开发计划（BILLING_QUOTA_CURRENCY_RATE）

> 本 plan 固化 **点数 ↔ 货币汇率** 能力的工程方案：在系统设置中新增多币种汇率配置（USD/CNY 等），让额度余额、成本、限额能够按货币展示，为后续 `LIMIT.md` 中 `spend` 金额维度与 USD 展示提供统一的换算口径。
>
> - 上游决策：`docs/technical/SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-10）、`docs/guide/LIMIT.md`（§3.5 spend 维度与倍率折算）
> - 上游 plan：`docs/plan/BILLING_QUOTA_PLAN.md`（已交付额度账户 + 扣费引擎，本 plan 在其上补「货币展示」）
> - 定稿时间：2026-11-03
> - 状态：已完成

---

## 1. 需求背景

当前系统只有「相对倍率 + 点数」这一条计量链路：`cost = multiplier × totalTokens`（点数），额度账户 `QuotaAccount.balance` 与充值 `amount` 均以「点数」为单位，**全系统没有货币/汇率概念**（无 `USD`/`currency`/`汇率` 字段）。用户无法直观看到「花了多少钱 / 还剩多少钱」。

现新增「点数 ↔ 货币」汇率配置，支持多币种（美元/人民币等），使余额、成本、限额可按货币展示，并为 `LIMIT.md` 的 `spend` 金额维度提供换算基准。

## 2. 目标

1. 在 `SystemSetting`（租户级 KV）中新增 `billing.currency` 配置：多币种汇率 + 默认展示货币。
2. 新增 `CurrencyService`：读取配置 + 点↔货币双向换算 + 未配置兜底（回退纯点数）。
3. 新增 API：`GET /system/currency`（成员可读）+ `PUT /system/currency`（`team_admin` 写入，结构化校验 + 审计埋点）。
4. 前端：系统设置页新增「货币汇率」配置卡片；计费页余额/流水「点数 + 货币金额」双显。
5. 本期**仅展示换算**，充值/调整仍按点数输入（不改变扣费口径，与 `billing_quota` 现有逻辑解耦）。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 存储 | 复用 `SystemSetting`（`tenantId + key` 唯一、`value` JSON），key = `billing.currency`，tenant 级（单团队版即全局） |
| 配置结构 | `{ displayCurrency: string, rates: { code, name, pointsPerUnit }[] }`，`pointsPerUnit` = 1 货币单位对应的点数（如 10000 点 = $1） |
| 换算方向 | 点→货币：`amount = points / pointsPerUnit`；货币→点：`points = amount × pointsPerUnit` |
| 换算服务 | `CurrencyService`（`system` 模块）：`getConfig(tenantId)` / `toCurrency(points, code)` / `toPoints(amount, code)`，未配置或币种缺失时返回 `null`（展示回退纯点数） |
| 配置 API | `GET /system/currency`（列表式返回 `CurrencyConfig`，成员可读）+ `PUT /system/currency`（`team_admin`，DTO 校验：code 唯一、pointsPerUnit > 0、displayCurrency 须在 rates 中）+ 审计埋点 |
| 前端展示 | 计费页拉取 `GET /system/currency`，用 `Intl.NumberFormat(locale, { style: 'currency', currency: code })` 格式化；点数与货币金额并列展示 |
| 口径统一 | 后续 `LIMIT.md` `spend` 维度复用同一 `CurrencyService`，避免两套换算口径漂移 |

## 4. RBAC 设计

| 资源 | 读 | 写 |
|---|---|---|
| `system/currency` | `member`/`team_admin`/`system` | `team_admin`/`system` |

## 5. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [BILLING_QUOTA_REQ-004](../requirement/BILLING_QUOTA_REQ-004_BACKEND_CURRENCY.md) | 后端：`CurrencyConfig` 类型 + 校验 + `CurrencyService`（读配置/双向换算/兜底）+ `GET/PUT /system/currency` + 审计埋点 + 单测 | `start:dev` 启动，Swagger 可调 `/system/currency` 读写，换算正确、未配置回退 `null`，lint/typecheck/test 通过 |
| [BILLING_QUOTA_REQ-005](../requirement/BILLING_QUOTA_REQ-005_FRONTEND_CURRENCY.md) | 前端：设置页「货币汇率」卡片（增删货币/设展示货币/填点数）+ 计费页余额/流水双显（点数 + 货币） | `dev`/`build` 通过，设置页可配置多币种汇率，计费页正确按币种展示 |

## 6. 里程碑

1. ✅ REQ-004 后端货币配置 + 换算服务（本文档拆解）。
2. ✅ REQ-005 前端设置页 + 计费页双显闭环。

## 7. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| C-01 | 汇率方向 | 定稿：`1 货币单位 = pointsPerUnit 点`（充值换算更直观） |
| C-02 | 范围 | 定稿：仅展示换算，充值/调整仍按点数输入，避免改动扣费引擎 |
| C-03 | 汇率维护 | 定稿：手动维护（管理员在设置页填写），不对接 FX API |
| C-04 | 历史数据 | 无汇率配置的历史租户回退「纯点数展示」，不迁移存量 |
| C-05 | 租户级配置 | 多租户下各租户独立维护汇率（单团队版即全局） |

## 8. 关联

- 上游：`SYSTEM_POSITIONING_AND_ARCHITECTURE.MD`（ADR-10）、`docs/guide/LIMIT.md`
- feature：`docs/feature/billing_quota.md`、`docs/feature/system_admin.md`
- 数据模型：`docs/technical/db_schema/SYSTEM_ADMIN_SCHEMA.MD`（补 `billing.currency` 结构）
- requirement：见 §5
