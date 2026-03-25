---
last_updated: 2026-03-25
status: Draft
related_stories: DT-C14
---

# PRD: DT-C14 公式计算列

## 1. 项目背景
*   **Story ID**: DT-C14
*   **Brief**: 公式计算列
*   **Description**: 作为用户，我需要创建基于其他列的公式计算列（四则运算），以便自动汇总和派生数据。

> [!IMPORTANT]
> 公式列为**只读派生列**，其值在渲染时实时计算，不存储到 Yjs 文档中。

## 2. 核心流程 (Workflow)

### 定义公式列
1. 宿主应用在 `ColumnDef` 中配置 `formula` 属性，值为字符串表达式
2. 表达式中通过列 ID 引用其他列（如 `"estimated_hours * 100 + score"`）
3. 组件解析表达式，编译为可执行函数

### 渲染与计算
1. 每行渲染时，从 `row.original` 提取被引用列的值，代入公式计算
2. 被引用列数据变更（本地编辑或协同同步）→ React 重渲染 → 公式列自动更新
3. 公式列 cell 不可编辑，双击无响应

### Tooltip 展示
*   鼠标 Hover 到公式列 Header 时，显示 Tooltip："计算公式: estimated_hours × 100 + score"
*   Tooltip 中列 ID 替换为列 `header` 显示名（人类可读）

### 错误处理
*   引用的列被删除 → 该行公式列显示 `#REF!`
*   计算结果为 `NaN` / `Infinity` → 显示 `#ERR!`
*   除以零 → 显示 `#DIV/0!`

```mermaid
graph TD
    A[ColumnDef.formula = 'col_a + col_b * 0.1'] --> B[解析表达式 → 提取引用列 IDs]
    B --> C[编译为 JS 函数: fn(row)]
    C --> D[每行渲染时调用 fn(row.original)]
    D --> E{计算结果}
    E -->|正常| F[渲染格式化数值]
    E -->|#REF! / NaN| G[渲染错误标记]
```

## 3. 验收标准 (Acceptance Criteria)

| ID | 描述 | 优先级 | 验证方式 | 状态 |
|:---|:---|:---|:---|:---|
| AC-14.1 | 公式列正确计算四则运算结果（`+` `-` `*` `/` 和括号） | P0 | 单元测试 | Pending |
| AC-14.2 | 被引用列数据变更时公式列自动重新计算 | P0 | E2E 测试 | Pending |
| AC-14.3 | 公式列为只读，不可进入编辑态 | P0 | UI 交互测试 | Pending |
| AC-14.4 | 鼠标 Hover Header 时 Tooltip 显示人类可读公式 | P0 | UI 测试 | Pending |
| AC-14.5 | 引用列被删除时显示 `#REF!`，除以零显示 `#DIV/0!` | P0 | 边界测试 | Pending |
| AC-14.6 | 5000 行下公式列渲染无明显卡顿（单行计算 ≤ 0.1ms） | P1 | 性能测试 | Pending |
| AC-14.7 | 公式列支持参与排序（按计算结果数值排序） | P1 | 功能测试 | Pending |

## 4. 技术规格 (Tech Spec)

### ColumnDef 扩展
```typescript
interface ColumnDef {
  // ...existing fields
  formula?: string;   // 公式表达式，如 "col_a + col_b * 0.1"
}
```

### 表达式解析器设计
*   **安全性**：禁止使用 `eval()`，采用简易 token 解析器
*   **支持的 token**：数字字面量 / 列 ID 引用 / `+` `-` `*` `/` / 括号 `(` `)`
*   **解析流程**：tokenize → parse (递归下降) → compile to function
*   **缓存**：公式字符串不变时，复用已编译函数 (useMemo)

```typescript
// 伪代码
function compileFormula(formula: string, columns: ColumnDef[]): (row: Record<string, any>) => number {
  const tokens = tokenize(formula);     // ['col_a', '+', 'col_b', '*', '0.1']
  const ast = parse(tokens);            // AST tree
  return (row) => evaluate(ast, row);   // 求值函数
}
```

### Tooltip 实现
*   利用 `ColumnDef` 查找表将公式中的列 ID 替换为 `header` 名
*   `"estimated_hours * 100 + score"` → `"预估工时 × 100 + 综合分"`

## 5. 范围边界 (Scope)
*   **In-Scope**: 四则运算公式、列引用、只读渲染、Tooltip、错误处理
*   **Out-of-Scope**: 聚合函数（SUM/AVG/COUNT）、跨行引用、条件表达式（IF/ELSE）、用户在 UI 中创建公式列

## 6. 待定问题 (Open Questions)
*   公式列是否需要支持 `numberFormat` 格式化？→ 建议支持，复用 DT-C13 能力。
*   公式列是否需要参与筛选？→ 建议 P2 支持。
