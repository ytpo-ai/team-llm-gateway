# 计划文档管理规范

## 1. 定位

`docs/plan/` 管理**方案/计划**层级的文档。每个 plan 是对一个功能模块（feature）下某个目标的功能方案固化，向下拆解为 1~3 个 requirement。

## 2. 层级关系

```
feature (功能模块)
  └── plan (计划方案)           1 feature → N plan
        └── requirement (需求)  1 plan → 1~3 requirement
```

- plan 是 requirement 的上游，plan 文档中列出其拆解出的所有 requirement。
- 一个 plan 对应一个可独立推进的目标；若目标过大，应先拆分为多个 plan。
- 拆解约束（粒度过大、上限 3 个）见 `docs/rules/REQUIREMENT.md` §2。

## 3. 文件命名规范

```
<MODULE>_<PLAN_NAME>_PLAN.md
```

- `<MODULE>`：所属功能模块，与 feature 文档名对齐（大写 + 下划线）。
- `<PLAN_NAME>`：方案主题（大写 + 下划线）。

### 示例

```
TENANT_AUTH_PLAN.md
TEAM_MANAGEMENT_OPTIMIZATION_PLAN.md
PORTAL_FOUNDATION_PLAN.md
```

## 4. 文档内容要求

核心结构（详见各 plan 文档约定）：

1. 头部元信息（上游决策 / 定稿时间 / **状态**）
2. 需求背景
3. 目标
4. 技术方案要点（或引用 technical 文档）
5. Requirement 拆解（列出所有 requirement 及验收条件）
6. 里程碑
7. 待决事项与风险
8. 关联（上游 / feature / requirement）

## 5. 状态定义

plan 顶部「状态」字段必须在整个生命周期内持续维护，而非仅在批准时写一次。

| 状态 | 中文标记 | 含义 |
|------|----------|------|
| `draft` | 草稿 | 方案草稿，待审批 |
| `approved` | 已批准 | 已批准，待开发 |
| `in-progress` | 进行中 | 至少一个 requirement 开发中 |
| `done` | 已完成 | 全部 requirement 已交付并验收 |
| `blocked` | 阻塞 | 被阻塞，需说明原因 |
| `superseded` | 已取代 | 被后续 plan 取代（保留历史追溯） |

### 5.1 完成态判定规则

- plan 达到 `done` 的唯一标准：**其 §5 拆解出的所有 requirement 状态均为 `done`（已交付）**。
- 任一 requirement 处于 `in-progress`/`in-review` 时，plan 应标记 `in-progress`。
- 全部 requirement 完成后，将顶部「状态」更新为 `done`（中文「已完成」），并将里程碑逐项打勾（✅）。

## 6. 与其他文档的关系

| 文档类型 | 关系 | 说明 |
|----------|------|------|
| `feature` | 上游 | plan 是 feature 下某个目标的功能方案 |
| `requirement` | 下游 | plan 拆解出 1~3 个 requirement |
| `technical` | 引用 | plan 可引用 technical 文档作为技术方案 |
| `issue` | 上游（可选） | plan 可由 issue 讨论结论派生 |

## 7. 约束执行检查点

- [ ] 新建 plan 时，是否已在对应 feature 文档的需求追溯表中登记 plan 行？
- [ ] plan 拆解 requirement 时，是否已在 plan §5 列出并关联所有 requirement？
- [ ] development 完成后，是否已同步更新对应 plan 的里程碑与状态？
- [ ] 全部 requirement 交付后，是否已将 plan 状态更新为 `done`（已完成）？
