# SERVICE_PROVIDER_CHANNEL_REQ-001 开发记录（预设分类扩展+Tabs组件+弹窗重构）

> 对应需求：`docs/requirement/SERVICE_PROVIDER_CHANNEL_REQ-001_PROVIDER_CHANNEL_TABS.md`
> 对应计划：`docs/plan/SERVICE_PROVIDER_CHANNEL_PLAN.md`
> 分支：`main`

## 1. 实现摘要

将"添加渠道"弹窗从两类入口（自定义 + 官方渠道）重构为三类入口（自定义 / 官方渠道 / 服务商），官方渠道与服务商通过 Tab 切换展示。后端预设增加 `category` 字段区分来源，并内置阿里云百炼 Token Plan 作为首批服务商预设。

- 后端：`OfficialProviderPreset` 新增 `category: 'official' | 'service-provider'` 字段；12 家官方预设标记 `category: 'official'`；新建 `SERVICE_PROVIDER_PRESETS` 含阿里云百炼 Token Plan（OpenAI 兼容 + Anthropic 双格式）。
- 后端：`models.service.ts` 的 `getOfficialPresets()` 静态回退路径合并返回官方 + 服务商预设。
- 前端：新建 `components/ui/tabs.tsx`（Tabs / TabsList / TabsTrigger / TabsContent，受控模式）。
- 前端：`features/models/types.ts` 新增 `PresetCategory` 类型。
- 前端：`pages/providers.tsx` 弹窗重构 —— 自定义渠道入口独立，官方渠道/服务商通过 Tabs 切换各展示预设卡片网格。

## 2. 代码改动点

### 后端

| 文件 | 说明 |
|---|---|
| `modules/models/official-presets.ts` | 新增 `PresetCategory` type + `category` 字段；12 家官方预设加 `category: 'official'`；新建 `SERVICE_PROVIDER_PRESETS` 数组（阿里云百炼 Token Plan，OpenAI 兼容 + Anthropic 双格式） |
| `modules/models/models.service.ts` | import `SERVICE_PROVIDER_PRESETS`；静态回退路径合并返回 `[...OFFICIAL_PRESETS, ...SERVICE_PROVIDER_PRESETS]` |

### 前端

| 文件 | 说明 |
|---|---|
| `components/ui/tabs.tsx` | **新建** Tabs 组件（4 个导出），受控模式，`useMemo` 避免不必要重渲染 |
| `features/models/types.ts` | 新增 `PresetCategory` type + `OfficialProviderPreset.category` 字段 |
| `pages/providers.tsx` | import Tabs；新增 `addTab` state + `officialOnlyPresets`/`serviceProviderPresets` 分类过滤；弹窗重构为自定义按钮 + Tabs（官方渠道 / 服务商），Tab 内容复用卡片网格渲染；服务商空态展示提示文案 |

### 文档

| 文件 | 说明 |
|---|---|
| `docs/plan/SERVICE_PROVIDER_CHANNEL_PLAN.md` | 新建计划文档 |
| `docs/requirement/SERVICE_PROVIDER_CHANNEL_REQ-001_PROVIDER_CHANNEL_TABS.md` | 新建需求文档 |
| `docs/feature/model_provider.md` | 需求追溯表新增 SERVICE_PROVIDER_CHANNEL 行 |

## 3. 踩坑记录

1. Tabs 组件初始用 `useState` 创建 context value 后直接修改属性，触发 oxlint `react(immutability)` 警告。改为 `useMemo` 计算 context value，依赖 `[value, onValueChange]`。
2. 服务商 Tab 为空时展示"暂无内置服务商，敬请期待"空态，避免空白区域造成困惑。

## 4. 验证结果

- 后端：tsc typecheck 通过、lint 通过、210 个测试全部通过
- 前端：tsc typecheck 通过、lint 仅既有警告（与本次无关）、build 通过（632 KB）

## 5. 关联

- feature：`docs/feature/model_provider.md`
- 计划：`docs/plan/SERVICE_PROVIDER_CHANNEL_PLAN.md`
- requirement：`docs/requirement/SERVICE_PROVIDER_CHANNEL_REQ-001_PROVIDER_CHANNEL_TABS.md`