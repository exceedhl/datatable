---
last_updated: 2026-03-25
status: Draft
related_stories: DT-C13
---

# PRD: DT-C13 数值格式化显示

## 1. 项目背景
*   **Story ID**: DT-C13
*   **Brief**: 数值格式化显示
*   **Description**: 作为用户，我需要对 `number` 类型列设置数字显示格式（小数位数、千分位、货币符号），以便数据展示更加规范清晰。

## 2. 核心流程 (Workflow)
1. 宿主应用在 `ColumnDef` 中配置 `numberFormat` 属性
2. 单元格查看态根据 `numberFormat` 渲染格式化后的文本
3. 双击进入编辑态时，显示原始数值（无格式化），方便用户直接修改
4. 提交编辑后，系统自动重新应用格式化展示

### 格式化示例

| 原始值 | 配置 | 显示结果 |
|---|---|---|
| `1234.5` | `{ decimals: 2, thousandSeparator: true }` | `1,234.50` |
| `1234.5` | `{ decimals: 0 }` | `1235` |
| `1234.5` | `{ currency: 'CNY' }` | `¥1,234.50` |
| `1234.5` | `{ currency: 'USD', decimals: 2 }` | `$1,234.50` |
| `0.156` | `{ decimals: 1, suffix: '%' }` | `15.6%` |

## 3. 验收标准 (Acceptance Criteria)

| ID | 描述 | 优先级 | 验证方式 | 状态 |
|:---|:---|:---|:---|:---|
| AC-13.1 | `decimals` 配置正确控制小数点位数（四舍五入显示，底层值不变） | P0 | 功能测试 | Pending |
| AC-13.2 | `thousandSeparator: true` 时数值显示千分位逗号分隔 | P0 | 功能测试 | Pending |
| AC-13.3 | `currency` 配置时自动添加对应货币符号前缀（`¥` / `$` / `€`） | P0 | 功能测试 | Pending |
| AC-13.4 | 编辑态显示原始数值，退出编辑后自动恢复格式化展示 | P0 | UI 交互测试 | Pending |
| AC-13.5 | 排序和筛选基于原始数值执行，不受格式化字符影响 | P0 | 功能测试 | Pending |
| AC-13.6 | 未配置 `numberFormat` 的 number 列保持当前行为不变 | P0 | 回归测试 | Pending |

## 4. 技术规格 (Tech Spec)

### ColumnDef 扩展
```typescript
interface ColumnDef {
  // ...existing fields
  numberFormat?: {
    decimals?: number;           // 小数位数，默认不限制
    thousandSeparator?: boolean; // 是否显示千分位，默认 false
    currency?: 'CNY' | 'USD' | 'EUR' | 'GBP' | 'JPY';  // 货币类型
    suffix?: string;             // 后缀，如 '%'
  };
}
```

### 实现方案
*   使用 `Intl.NumberFormat` API 实现格式化，天然支持国际化
*   格式化函数 `formatNumber(value, config)` 作为 pure function 供 `<ReactivateCell />` 调用
*   编辑态切换时，cell 组件直接使用 `row.original[colId]` 原始值作为 input value

### 货币符号映射
| currency | 符号 | locale |
|---|---|---|
| `CNY` | ¥ | `zh-CN` |
| `USD` | $ | `en-US` |
| `EUR` | € | `de-DE` |
| `GBP` | £ | `en-GB` |
| `JPY` | ¥ | `ja-JP` |

## 5. 范围边界 (Scope)
*   **In-Scope**: 小数位数、千分位、货币、后缀格式化；编辑态原始值展示
*   **Out-of-Scope**: 用户在 UI 中动态切换格式（当前由 ColumnDef 静态配置）；会计格式（负数红色/括号展示）
