# Portal 前端 UI 规范落地计划（PORTAL_UI_REFINEMENT）

> 本 plan 固化 Portal 前端 UI 规范（`docs/rules/UI.md`）的落地方案：补齐 UI 基础原语，并将现有「列表 + 平铺表单」的 CRUD 页面改造为「列表为主体 + 弹窗/抽屉承载低频操作」。
>
> - 上游规范：`docs/rules/UI.md`
> - 上游 feature：`docs/feature/portal_ui.md`
> - 定稿时间：2026-11-03
> - 状态：`done`（已完成）

---

## 1. 需求背景

Portal 前端各 CRUD 页面（渠道、模型、API Key、团队、角色、租户、额度）目前将「添加/编辑」表单**平铺成 Card** 直接展示在列表上方，删除操作点击即执行、无二次确认。这与 `docs/rules/UI.md` 确立的规范冲突：

- 添加/编辑是低频临时操作，应以弹窗/抽屉承载，不与列表平铺。
- 危险操作（删除/吊销/轮换/停用）必须二次确认。
- 存在 `selectClass` 在三个页面重复手写、`text-destructive` token 未定义（渲染失效）等复用与一致性问题。

## 2. 目标

1. 补齐 shadcn/ui 原语：dialog、sheet、alert-dialog、select、label（基于 `@radix-ui/*`）。
2. 补全 `index.css` 的 `--destructive` design token。
3. 将 7 个 CRUD 页面的平铺表单迁移到弹窗/抽屉，删除等危险操作加二次确认。
4. 统一 select 下拉为 radix Select，消除手写重复样式。
5. 清理 `docs/rules/UI.md` 中的「反例」标注（改造完成后不再违规）。

## 3. 技术方案要点

| 项 | 方案 |
|---|---|
| 弹窗/抽屉原语 | `@radix-ui/react-dialog`（dialog + sheet 均基于它）、`@radix-ui/react-alert-dialog` |
| 下拉 | `@radix-ui/react-select`（弹层式，替代原生 `<select>` 手写样式） |
| 表单标签 | `@radix-ui/react-label` |
| design token | `index.css` 补 `--destructive` / `--color-destructive`，统一危险/错误态颜色 |
| 交互承载 | 按 `docs/rules/UI.md` §3 决策：复杂表单（>4 字段）走抽屉，简单表单/确认走弹窗 |
| 状态管理 | 沿用 react-query（服务端）+ 组件 `useState`（弹窗开合/表单本地态），不改 zustand |

## 4. 弹窗 vs 抽屉 映射（本 plan 决策）

| 页面 | 操作 | 承载 |
|------|------|------|
| providers | 添加/编辑渠道（5 字段 + 脱敏说明） | 抽屉 |
| providers | 官方直连开启（key + 名称） | 弹窗 |
| models | 添加/编辑模型（6 字段） | 抽屉 |
| models | 官方预设导入（多选列表） | 抽屉 |
| api-keys | 创建/编辑 Key（7 字段） | 抽屉 |
| api-keys | 轮换后一次性 key 展示 | 弹窗 |
| team | 邀请成员（2 字段） | 弹窗 |
| team | 团队使用限额（3 字段） | 弹窗 |
| roles | 添加/编辑角色（7 字段） | 抽屉 |
| admin-tenants | 新建租户（2 字段） | 弹窗 |
| billing | 充值/调整额度 | 弹窗 |

## 5. Requirement 拆解

| Requirement | 内容 | 验收条件 |
|---|---|---|
| [PORTAL_UI_REQ-001](../requirement/PORTAL_UI_REQ-001_UI_PRIMITIVES.md) | UI 基础原语 + radix 依赖 + destructive token | `pnpm lint`/`typecheck`/`build` 通过，`ui/` 下 5 个原语就绪 |
| [PORTAL_UI_REQ-002](../requirement/PORTAL_UI_REQ-002_CRUD_PAGE_MIGRATION.md) | 7 个 CRUD 页面迁移到弹窗/抽屉 + 删除二次确认 | 各页面添加/编辑不再平铺，删除有确认，`dev` 目检闭环可用 |
| [PORTAL_UI_REQ-003](../requirement/PORTAL_UI_REQ-003_LOG_SELECT_DOCS.md) | 日志/审计页 select 统一 + UI.md 反例清理 | 无手写 select 样式残留，UI.md 反例小节移除 |

## 6. 里程碑

1. ✅ REQ-001 UI 基础原语。
2. ✅ REQ-002 CRUD 页面迁移。
3. ✅ REQ-003 select 统一 + 文档清理。

## 7. 待决事项与风险

| 编号 | 事项 | 状态 |
|---|---|---|
| U-01 | radix 依赖走默认 pnpm 源，需网络 | 已确认可安装（`strict-peer-dependencies=false`、`auto-install-peers=true`） |
| U-02 | 前端无单测，验证依赖 lint/typecheck/build + 手动 dev 目检 | 已知，验证方式见各 REQ 验收 |
| U-03 | `settings.tsx` 为表单型配置页，非「列表+增删改查」，不纳入本次改造 | 已决策，保持平铺 Card |

## 8. 关联

- 上游规范：`docs/rules/UI.md`
- feature：`docs/feature/portal_ui.md`
- requirement：见 §5
