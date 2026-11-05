# SERVICE_PROVIDER_CHANNEL_REQ-001 后端预设分类扩展 + 前端 Tabs 组件 + 弹窗重构

> - 所属 feature：`docs/feature/model_provider.md`
> - 所属 plan：`docs/plan/SERVICE_PROVIDER_CHANNEL_PLAN.md`
> - 状态：`done`

---

## 验收条件

1. `OfficialProviderPreset` 增加 `category: 'official' | 'service-provider'` 字段
2. 现有 12 家官方预设标记 `category: 'official'`
3. 新增 `SERVICE_PROVIDER_PRESETS` 数组，首批含阿里云百炼 Token Plan
4. `GET /models/presets` 返回合并后的全部预设（含 category）
5. 前端新建 `components/ui/tabs.tsx` 组件，支持受控模式
6. "添加渠道"弹窗重构：自定义渠道按钮独立，官方渠道/服务商 Tab 切换，各 Tab 展示对应预设卡片
7. 前后端 lint / typecheck / build 通过

## Development

- [SERVICE_PROVIDER_CHANNEL_REQ-001_DEVELOPMENT.md](../development/SERVICE_PROVIDER_CHANNEL_REQ-001_DEVELOPMENT.md)

## Fix

（暂无）