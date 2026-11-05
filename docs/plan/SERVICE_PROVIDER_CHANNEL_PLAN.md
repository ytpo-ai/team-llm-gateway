# 添加渠道分类重构：自定义 / 官方渠道 / 服务商 Tab 开发计划（SERVICE_PROVIDER_CHANNEL）

> 本 plan 将"添加渠道"弹窗重构为三类入口（自定义 / 官方渠道 / 服务商），官方渠道与服务商通过 Tab 切换展示，并内置服务商预设（如阿里云百炼 Token Plan）。
>
> - 上游决策：本 plan 无上游引用
> - 定稿时间：2026-11-05
> - 状态：`done`

---

## 1. 需求背景

当前"添加渠道"弹窗仅有"自定义渠道"按钮和"官方渠道"卡片区（12 家厂商预设）。实际业务中存在另一类渠道——**服务商**（如阿里云百炼 Token Plan），用户购买套餐后通过 Token 接入，其接入方式与直连 API Key 不完全一致但流程相同。

现需要：
1. 将渠道入口分为三类：自定义（手动填写）、官方渠道（直连 API Key）、服务商（Token Plan 套餐接入）
2. 添加渠道弹窗中，官方渠道与服务商通过 Tab 切换展示
3. 内置服务商预设（首批：阿里云百炼 Token Plan）

## 2. 目标

1. 预设数据增加 `category` 字段（`'official' | 'service-provider'`），现有 12 家标记为 `official`
2. 新增服务商预设数组（`SERVICE_PROVIDER_PRESETS`），首批内置阿里云百炼 Token Plan
3. 前端新建 `Tabs` UI 组件，遵循现有组件风格
4. 重构"添加渠道"弹窗：自定义渠道入口独立，官方渠道/服务商通过 Tab 切换
5. 服务商渠道创建复用 `POST /providers/from-preset` 流程，无需新增 API

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 预设分类 | `OfficialProviderPreset` 加 `category` 字段；`models.service.ts` 合并返回两类预设 |
| 服务商预设 | 新建 `SERVICE_PROVIDER_PRESETS` 常量数组，结构与官方预设一致 |
| Tab 组件 | 新建 `components/ui/tabs.tsx`，轻量实现（无需第三方库），支持受控模式 |
| 弹窗重构 | 自定义渠道入口保留（按钮卡片 → 独立 Dialog）；官方渠道/服务商用 Tabs 承载各自的卡片网格 |
| 开启流程 | 服务商渠道开启复用 `createProviderFromPreset` → 与官方渠道一致：填 Key → 建渠道 → 自动导入模型 |

## 4. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [SERVICE_PROVIDER_CHANNEL_REQ-001](../requirement/SERVICE_PROVIDER_CHANNEL_REQ-001_PROVIDER_CHANNEL_TABS.md) | 后端预设分类扩展 + 前端 Tabs 组件 + 弹窗重构 | 预设含 category 字段；前端 Tabs 功能正常；弹窗三类入口可用；lint/typecheck/build 通过 |

## 5. 里程碑

1. ✅ REQ-001 后端预设分类扩展 + 前端 Tabs 组件 + 弹窗重构。

## 6. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| C-01 | 阿里云百炼 Token Plan 的模型 ID / 倍率需后续人工核对 | 先跑通再优化 |
| C-02 | 远程预设 URL 需同步包含 `category` 字段 | 先静态内置，远程下发后续跟上 |

## 7. 关联

- feature：`docs/feature/model_provider.md`
- requirement：见 §4