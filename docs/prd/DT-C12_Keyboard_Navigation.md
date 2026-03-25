---
last_updated: 2026-03-25
status: Draft
related_stories: DT-C12
---

# PRD: DT-C12 键盘导航

## 1. 项目背景
*   **Story ID**: DT-C12
*   **Brief**: 键盘导航
*   **Description**: 作为用户，我需要使用方向键在单元格之间移动选中焦点，以提高键盘操作效率。

## 2. 核心流程 (Workflow)

### 导航态（cell 已选中，未编辑）
| 按键 | 行为 |
|---|---|
| `↑` `↓` `←` `→` | 移动选中焦点到相邻 cell |
| `Tab` | 向右移动到下一个可编辑 cell（行末自动跳转下一行首） |
| `Shift + Tab` | 反向移动 |
| `Enter` | 进入当前 cell 编辑态 |
| `Delete` / `Backspace` | 清空当前 cell 值（不进入编辑态） |

### 编辑态（cell 正在编辑）
| 按键 | 行为 |
|---|---|
| `Enter` | 提交当前值，退出编辑态，选中焦点移至下一行同列 |
| `Escape` | 取消编辑（恢复原值），退出编辑态，保持当前 cell 选中 |
| `Tab` | 提交当前值，选中焦点移至右侧下一个可编辑 cell |

### 边界处理
*   到达表格边界时停留在最后一个 cell（不循环）
*   焦点移动到可视区域外时，自动触发 `virtualizer.scrollToIndex()` 滚动
*   遇到不可编辑 cell 时，`Tab` 跳过该 cell
*   分组标题行不参与键盘导航，方向键直接跳过到下一数据行

## 3. 验收标准 (Acceptance Criteria)

| ID | 描述 | 优先级 | 验证方式 | 状态 |
|:---|:---|:---|:---|:---|
| AC-12.1 | 选中 cell 后 ↑↓←→ 移动焦点到相邻 cell | P0 | UI 交互测试 | Pending |
| AC-12.2 | Tab/Shift+Tab 在可编辑 cell 间跳转，跳过不可编辑 cell | P0 | UI 交互测试 | Pending |
| AC-12.3 | Enter 进入编辑态，再次 Enter 提交并移至下一行同列 | P0 | UI 交互测试 | Pending |
| AC-12.4 | Escape 取消编辑并恢复原值 | P0 | 功能测试 | Pending |
| AC-12.5 | 焦点移出可视区域时自动滚动使目标 cell 可见 | P0 | 布局测试 | Pending |
| AC-12.6 | 分组标题行自动跳过，不影响导航流畅性 | P1 | 边界测试 | Pending |

## 4. 技术规格 (Tech Spec)

### 焦点管理
```typescript
interface CellFocusState {
  rowIndex: number;       // 逻辑行索引（过滤/排序后的列表位置）
  columnIndex: number;    // 列索引
  isEditing: boolean;     // 编辑态标记
}
```

### 关键设计
*   **事件监听**：在 table container 级别监听 `onKeyDown` 事件，统一分发
*   **焦点与虚拟化协调**：移动焦点时先调用 `scrollToIndex()`，等待渲染后再设置 DOM focus
*   **防止浏览器默认行为**：方向键和 Tab 需要 `e.preventDefault()` 避免页面滚动

## 5. 范围边界 (Scope)
*   **In-Scope**: 方向键导航、Tab 跳转、Enter/Escape 编辑态切换、自动滚动
*   **Out-of-Scope**: 多 cell 区域选择 (Shift + 方向键选区)、复制粘贴快捷键 (Ctrl+C/V)
