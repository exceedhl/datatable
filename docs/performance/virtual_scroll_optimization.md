# 虚拟滚动性能优化

> 日期：2026-03-25 | 组件：CollaborativeTable

## 问题

快速滚动时出现短暂空白（白闪），虚拟行来不及渲染。

## 根因分析

| # | 根因 | 影响 | 位置 |
|---|------|:---:|------|
| 1 | **overscan 过低** (10) — 快速滚动瞬间滚过缓冲区 | ⭐⭐⭐⭐⭐ | `index.tsx` virtualizer 配置 |
| 2 | **ReactiveCell 挂载开销大** — 每个 cell 4 个 useEffect + 全量 awareness 订阅 | ⭐⭐⭐⭐⭐ | `ReactiveCell.tsx` |
| 3 | **Card Wrapping DOM 嵌套** — 分组 3 层时每行 3 层额外 div | ⭐⭐⭐⭐ | `index.tsx` wrapWithCards |
| 4 | **estimateSize 回调复杂** — 滚动时被调用上千次，含 `Array.some()` | ⭐⭐⭐ | `index.tsx` virtualizer 配置 |
| 5 | **memo 依赖不稳定** — `rows` 每次是新引用导致 vItems 重算 | ⭐⭐⭐ | `index.tsx` useMemo |
| 6 | **`transition-all` CSS** — 拦截所有属性变化做动画插值 | ⭐⭐ | `ReactiveCell.tsx` |

## 已实施方案

### 1. overscan 10 → 25

```diff
- overscan: 10,
+ overscan: 25,
```

多缓冲 ~600px 预渲染区域，内存换流畅度。

### 2. awareness 订阅精细化

```diff
- const activeCursors = useAwarenessStore(s => s.activeCursors);
- const myCursors = Object.values(activeCursors).filter(c => c.rowId === rowId && c.colId === colId);
+ const cellCursors = useAwarenessStore(
+   useShallow((s) => {
+     const matches = [];
+     for (const c of Object.values(s.activeCursors)) {
+       if (c.rowId === rowId && c.colId === colId) matches.push(c);
+     }
+     return matches;
+   })
+ );
```

只有当前 cell 的 cursor 变化才触发 re-render，避免一个 cursor 移动导致所有 cell 重渲染。

### 3. estimateSize 预计算

将高度计算从热路径 `estimateSize` 回调移至 `vItems` memo 阶段：

```diff
// vItems memo 中预计算
+ v.cachedHeight = h;

// virtualizer 配置
- estimateSize: i => { /* 复杂计算 */ }
+ estimateSize: i => vItems[i]?.cachedHeight ?? 40,
```

### 4. transition-all → transition-colors

```diff
- className="... transition-all duration-100 ..."
+ className="... transition-colors duration-100 ..."
```

避免滚动时不必要的 CSS composite 层调度。

### 5. 合并 useEffect (4 → 1)

将 keyboard editing、value sync、deselection 三个独立 effect 合并为一个，减少每个 cell 的 mount/unmount 开销。

## 未实施（P3，备选）

| 方案 | 难度 | 说明 |
|------|:---:|------|
| 稳定 `rows` 引用 | 中等 | 对 `table.getRowModel().rows` 做浅比较缓存，避免 vItems 无谓重算 |
| 简化 card wrapping DOM | 较大 | 用 CSS padding + 单层 border 模拟嵌套卡片，减少 DOM 节点数 |

## 通用经验

1. **虚拟列表的 overscan 不要太低** — 行高 40px 时，overscan=25 ≈ 1000px 缓冲，对现代设备内存影响可忽略
2. **zustand 订阅要用 selector** — 全量订阅是性能杀手，用 `useShallow` + 精确 selector
3. **`transition-all` 是陷阱** — 只对需要动画的属性做 transition
4. **热路径函数要纯查表** — `estimateSize` 这类高频调用应预计算、直接返回
5. **合并同类 useEffect** — 多个小 effect 的 setup/teardown 开销会在虚拟列表中被放大
