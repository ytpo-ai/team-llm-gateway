# UI 前端设计规范

本文档约束 `apps/portal-frontend` 的界面实现方式，目标是降低用户心智负担、保持交互与视觉一致性，并让后续前端开发有据可依。

---

## 0. 技术栈基线

| 维度 | 约定 |
|------|------|
| 框架 | React 19（函数式组件 + Hooks）+ TypeScript 严格模式 |
| 样式 | Tailwind CSS v4，通过 `src/index.css` 的 CSS 变量 token 取色 |
| 组件 | shadcn/ui（style=new-york，baseColor=neutral，CSS variables），统一放在 `src/components/ui/` |
| 服务端状态 | @tanstack/react-query（useQuery / useMutation） |
| 客户端状态 | zustand（仅 UI 状态与 auth），**禁止用 zustand 存服务端数据** |
| 路由 | react-router v7 |
| 图标 | lucide-react |

---

## 1. 组件复用原则

1. **通用控件一律落地到 `src/components/ui/`**，禁止在 feature/pages 内私藏可复用组件。
2. **禁止手写重复样式字符串**。下拉统一用共享 `Select` 原语，禁止在页面内内联手写 `<select className=...>`。
3. 样式优先使用 Tailwind 语义 token：`bg-background` / `text-foreground` / `text-muted-foreground` / `border-input` / `border-border` / `ring-ring`，禁止硬编码色值（除非是状态色，见 §6）。
4. 状态色固定语义：
   - 成功 → `text-green-600`
   - 错误 → `text-red-500`（破坏性操作按钮用 `destructive` token）
   - 次要/禁用说明 → `text-muted-foreground`
5. 通用原语已就绪：`button` / `card` / `input` / `dialog`（弹窗）/ `sheet`（抽屉）/ `alert-dialog`（二次确认）/ `select` / `label`。新增原语时按 shadcn new-york 风格落地到 `components/ui/`，并保持与 `components.json` 一致。

---

## 2. 数据资源页面布局（CRUD 主约定）

UI 本质是某种数据资源的管理可视化，以列表 + 增删改查为主（团队、渠道、模型、API Key 皆是）。核心约定：

1. **页面以列表为唯一主体**，添加/编辑等低频临时操作**不以 Card/区块平铺在页面中**，而用弹窗或抽屉承载。
2. 页面自上而下的标准结构：

   ```
   标题区（h1 标题 + 一行 muted 描述）
     ↓
   工具条（搜索/筛选 + 右上角主操作按钮「+ 添加」）
     ↓
   列表（table 或卡片网格）
     ↓
   分页 / 空态
   ```

3. **主操作按钮固定放在列表右上角**（工具条区），不在页面顶部另开一块表单区。
4. 列表行内仅放高频、轻量的行内操作（如启用/禁用切换）；低频操作（编辑、删除）也走行内按钮，但承载在弹窗/抽屉中，或删除前二次确认。

---

## 3. 弹窗（Dialog）vs 抽屉（Sheet）选择标准

按「两者结合」判断，先看是否打断主流程，再看内容复杂度。

### 判据一：是否打断主流程

| 场景 | 承载 |
|------|------|
| 需要参照列表/页面上下文（如编辑时对照其它行、看长详情） | 抽屉（Sheet） |
| 一次性决策、强聚焦、完成后即关闭（确认、简单新增） | 弹窗（Dialog） |

- 弹窗会打断并屏蔽主页面其它展示，让用户聚焦当前流程；抽屉则保留主页面可见，适合边看边操作。
- 添加/编辑本身是低频临时操作，默认优先抽屉，避免遮住列表。

### 判据二：内容复杂度

| 表单复杂度 | 承载 |
|-----------|------|
| 简单表单（≤ 4 个字段、无多步骤、无大段说明） | 弹窗 |
| 复杂表单（字段多、有分步、长文本/多区块、需要宽空间） | 抽屉 |
| 详情展示 / 只读浏览 | 抽屉 |

### 决策顺序

```
第一步：操作是否需要参照主页面上下文？
    ├── 是 → 抽屉
    └── 否 → 第二步：内容是否复杂（>4 字段 / 分步 / 长表单）？
              ├── 是 → 抽屉
              └── 否 → 弹窗
```

### 典型映射

| 操作 | 建议 |
|------|------|
| 删除确认、简单开关切换 | 弹窗（Dialog / AlertDialog） |
| 添加/编辑渠道（字段多、含 key 脱敏说明） | 抽屉 |
| 邀请成员（简单，2 字段） | 弹窗 |
| 团队限额（3 字段） | 弹窗 |
| 模型/渠道详情、审计日志详情 | 抽屉 |

---

## 4. 交互规范

1. **删除必须二次确认**：危险操作（删除成员、删除渠道、禁用、撤销、吊销、轮换）禁止点击即执行，用 AlertDialog 确认后再触发 mutation。
2. **提交中禁用 + 反馈**：所有 mutation 提交期间，触发按钮必须 `disabled` 并显示 pending 文案（如「保存中…」「开启中…」），禁止重复提交。
3. **错误反馈**：接口错误用 `ApiError.message` 呈现（`text-red-500`），兜底文案「操作失败，请稍后重试」；成功不依赖 alert，用状态刷新或轻量提示。
4. **空态 / 加载态 / 错误态**三者必覆盖：
   - 加载：`加载中…`（`text-muted-foreground`）
   - 空列表：明确引导（如「暂无上游渠道，点击右上角添加」）
   - 错误：展示错误信息并提供重试入口
5. **权限态**：无权限时展示明确提示（如「仅团队管理员可管理上游渠道」），而非空白页。

---

## 5. 服务端状态管理约定

1. 所有服务端数据一律走 **react-query**：`useQuery` 读、`useMutation` 写，写完用 `queryClient.invalidateQueries` 刷新，禁止手动塞 `useState` 缓存接口返回。
2. `useMutation` 的 `onError` 必须处理 `ApiError`，区分「业务错误信息」与「网络兜底文案」。
3. zustand 仅用于客户端全局状态（当前为 `auth`），**禁止**把 provider 列表、成员列表等接口数据同步进 zustand。

---

## 6. 视觉一致性

1. 页面根容器统一 `space-y-6`，标题区用 `h1.text-xl.font-semibold` + `p.text-sm.text-muted-foreground` 描述。
2. 列表表格统一 `w-full text-sm`，表头 `border-b text-left text-muted-foreground`，行 `border-b last:border-0`。
3. 卡片用 shadcn `Card/CardHeader/CardTitle/CardDescription/CardContent`，禁止自造卡片 div。
4. 表单字段用 `label`（`mb-1 block text-sm text-muted-foreground`）+ 控件，字段说明/占位用 placeholder。
5. 明暗双主题均须可用（依赖 CSS 变量 token，禁止写死浅色值导致 dark 模式失效）。

---

## 7. 目录与命名约定

feature 目录按职责拆分：

```
src/features/<resource>/
  ├── api.ts      # 接口调用（react-query 的 queryFn / mutationFn 用）
  ├── types.ts    # 实体类型与常量（LABELS、枚举等）
  ├── store.ts    # （可选）zustand，仅客户端状态
  └── components/ # （可选）该 feature 的私有无复用组件
```

- 页面入口放 `src/pages/<resource>.tsx`，命名 `XxxPage`。
- 组件 PascalCase、函数/变量 camelCase、文件 kebab-case（遵循 AGENTS.md 命名规范）。

---

## 8. 约束执行检查点

开发或修改前端时，自查：

- [ ] 页面是否以列表为主体，添加/编辑是否用弹窗/抽屉承载（而非平铺 Card）？
- [ ] 弹窗 vs 抽屉是否按 §3 决策顺序选择？
- [ ] 是否复用了 `components/ui/` 原语，有无手写重复样式字符串？
- [ ] 删除等危险操作是否加了二次确认？
- [ ] 提交按钮是否有 pending 禁用与文案？
- [ ] 空态 / 加载态 / 错误态是否三态齐全？
- [ ] 服务端数据是否全部走 react-query（未塞进 useState/zustand）？
- [ ] 颜色是否用语义 token 与状态色，dark 模式是否可用？
