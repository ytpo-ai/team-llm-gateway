# OFFICIAL_API_REQ-011 开发记录（后端：官方预置目录新增 Kimi Code）

> 对应需求：`docs/requirement/OFFICIAL_API_REQ-011_BACKEND_KIMI_CODE_PRESET.md`
> 对应计划：`docs/plan/OFFICIAL_CHANNEL_KIMI_CODE_PLAN.md`
> 分支：`main`

## 1. 实现摘要

官方渠道只是「渠道创建」的快捷方式：系统预填 label/URL/协议并自动导入官方模型。本期在预置目录中新增 Moonshot AI 独立编码平台「Kimi Code」，与「Moonshot Kimi」并列。

- `OFFICIAL_PRESETS` 新增 `kimi-code` 项（`key: 'kimi-code'`、`label: 'Kimi Code'`），OpenAI 兼容端点 `https://api.kimi.com/coding/v1`（国内）。
- 模型清单：`k3`（旗舰，1M 上下文）、`kimi-for-coding`（均衡，256K）、`kimi-for-coding-highspeed`（高速，256K），能力标签对齐 `capabilities` 字典，倍率占位（`k3=1` / `kimi-for-coding=0.5` / `highspeed=0.8`）。
- 前端零改动：`providers.tsx` 动态渲染 `GET /models/presets` 下发的预置列表，新增项自动出现在「添加渠道 → 官方渠道」并复用 `POST /providers/from-preset` 一键开启。

## 2. 代码改动点

### 后端

| 文件 | 说明 |
|---|---|
| `modules/models/official-presets.ts` | `OFFICIAL_PRESETS` 在 `moonshot` 之后新增 `kimi-code` 项（formats + 3 模型） |

## 3. 踩坑记录

1. `formats` 按协议类型去重（前端 `SelectItem` 以 `type` 为 key、`selectEnableFormat` 按 `type` 查找），无法同时表达国内/海外两个同协议端点；默认取国内 `api.kimi.com`，海外团队可在开启弹窗手动改 URL。
2. 模型倍率无官方精确报价，按占位估算处理，后续可按实调整（plan C-02）。

## 4. 验证结果

- 后端：typecheck 通过、lint 0/0、test 207 passed（`getOfficialPresets` 相关用例为泛化断言，不受新增预置影响）。

## 5. 关联

- feature：`docs/feature/model_provider.md`
- 计划：`docs/plan/OFFICIAL_CHANNEL_KIMI_CODE_PLAN.md`
