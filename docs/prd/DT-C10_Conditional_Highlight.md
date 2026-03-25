---
last_updated: 2026-03-25
status: Draft
related_stories: DT-C10
---

# PRD: DT-C10 条件高亮（Conditional Formatting）

## 1. 项目背景
*   **Story ID**: DT-C10
*   **Brief**: 条件高亮
*   **Description**: 作为用户，我需要根据条件自动高亮单元格，以便快速识别关键数据（异常值、状态标记等）。

## 2. 核心流程 (Workflow)

### 创建规则
1. 用户点击工具栏"条件格式" 按钮
2. 弹出条件格式配置面板（Popover）
3. 用户点击"+ 添加规则"
4. 选择目标列 → 选择条件运算符 → 输入阈值 → 选择高亮颜色
5. 规则立即应用到表格，实时预览效果

### 条件运算符适配列类型

| 列类型 | 可用运算符 |
|---|---|
| `number` | 大于 / 小于 / 等于 / 范围内 / 为空 |
| `string` | 包含 / 不包含 / 等于 / 为空 |
| `enum` | 等于 / 不等于 / 为空 |
| `date` | 早于 / 晚于 / 范围内 / 为空 |

### Header 区域规则指示
*   已配置条件格式的列，Header 右侧显示一个彩色圆点指示器
*   点击圆点可快速跳转到对应规则编辑
*   多条规则时圆点叠加显示（最多显示 3 个，超出显示 `+N`）

```mermaid
graph LR
    A[点击工具栏条件格式] --> B[打开配置面板]
    B --> C[+ 添加规则]
    C --> D[选择列]
    D --> E[自动适配运算符]
    E --> F[输入阈值]
    F --> G[选择高亮颜色]
    G --> H[实时预览]
    H --> I[保存规则集合到本地 State]
```

## 3. 验收标准 (Acceptance Criteria)

| ID | 描述 | 优先级 | 验证方式 | 状态 |
|:---|:---|:---|:---|:---|
| AC-10.1 | 可创建条件格式规则，选择列 + 条件 + 颜色后即时应用高亮 | P0 | UI 交互测试 | Pending |
| AC-10.2 | 条件运算符根据列类型自动适配（number 显示数值比较，string 显示文本匹配） | P0 | 功能测试 | Pending |
| AC-10.3 | 已配置规则的列 Header 显示彩色圆点指示器 | P0 | UI 视觉验证 | Pending |
| AC-10.4 | 支持添加多条规则，冲突时按优先级（列表从上到下）取最高优先级 | P1 | 边界测试 | Pending |
| AC-10.5 | 支持删除和编辑已有规则 | P0 | UI 交互测试 | Pending |
| AC-10.6 | 条件格式为本地视图状态，不触发 Yjs 同步 | P0 | 通信黑盒测试 | Pending |
| AC-10.7 | 5000 行数据下条件格式应用耗时 ≤ 50ms | P1 | 性能测试 | Pending |

## 4. 技术规格 (Tech Spec)

### 数据模型
```typescript
interface ConditionalRule {
  id: string;                     // 规则 UUID
  columnId: string;               // 目标列 ID
  operator: ConditionOperator;    // 运算符
  value: string | number | [number, number];  // 阈值（范围用数组）
  style: {
    backgroundColor: string;      // 高亮背景色
    textColor?: string;           // 文字颜色（可选）
  };
}

type ConditionOperator =
  | 'gt' | 'lt' | 'eq' | 'between' | 'empty'           // number
  | 'contains' | 'not_contains' | 'str_eq' | 'empty'    // string
  | 'enum_eq' | 'enum_neq' | 'empty'                    // enum
  | 'before' | 'after' | 'date_between' | 'empty';      // date
```

### 性能设计
*   规则编译为 `(value: any) => CSSProperties | null` 函数，缓存在 `useMemo` 中
*   每个 cell 渲染时调用已编译函数，O(1) 复杂度
*   规则变更时批量重新编译，不逐行遍历

## 5. UI/UX 交互
*   **配置面板**：Popover 形式，宽度 400px，内含规则列表
*   **规则行**：列选择器 | 运算符下拉 | 阈值输入 | 颜色选择圆 | 删除按钮
*   **颜色预设**：提供 8 色快捷选择（红/橙/黄/绿/蓝/紫/灰/自定义）
*   **Header 指示器**：6px 实心圆点，absolute 定位在 Header 右上角

## 6. 范围边界 (Scope)
*   **In-Scope**: 单元格背景色高亮、Header 指示器、规则 CRUD、按列类型适配运算符
*   **Out-of-Scope**: 行级高亮（整行变色）、图标类条件格式（如进度条、数据条）、跨列条件
