import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  flexRender, SortingState, createColumnHelper, Row, ColumnSizingState, VisibilityState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCRDT } from './useCRDT';
import { ReactiveCell } from './ReactiveCell';
import { FilterPanel } from './FilterPanel';
import { GroupToolbar } from './GroupToolbar';
import { RowContextMenu } from './RowContextMenu';
import { ColumnManager } from './ColumnManager';
import { ConditionalFormatPanel, compileConditionalRules } from './ConditionalFormatPanel';
import { useKeyboardNav } from './useKeyboardNav';
import { useViewPersistence } from './useViewPersistence';
import type { DataColumnDef, FilterCondition, ConditionalRule } from './types';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger,
} from '@/components/ui/context-menu';

const columnHelper = createColumnHelper<any>();

// --- Group bucketization ---
interface GroupBucket {
  key: string; value: any; fieldId: string; colDef?: DataColumnDef;
  rows: Row<any>[]; subGroups?: GroupBucket[];
}

function bucketize(rows: Row<any>[], fields: string[], cols: DataColumnDef[], d = 0): GroupBucket[] {
  if (d >= fields.length) return [];
  const fid = fields[d];
  const cd = cols.find(c => c.id === fid);
  const map = new Map<any, Row<any>[]>();
  rows.forEach(r => { const v = r.original[fid]; if (!map.has(v)) map.set(v, []); map.get(v)!.push(r); });
  return Array.from(map.entries()).map(([v, rs]) => ({
    key: `${fid}:${v}`, value: v, fieldId: fid, colDef: cd, rows: rs,
    subGroups: d + 1 < fields.length ? bucketize(rs, fields, cols, d + 1) : undefined,
  }));
}

function applyFilters(data: any[], filters: FilterCondition[]): any[] {
  if (!filters.length) return data;
  return data.filter(row => filters.every(f => {
    const v = row[f.fieldId];
    if (f.type === 'string') return !f.value || String(v || '').toLowerCase().includes(String(f.value).toLowerCase());
    if (f.type === 'number') { const [mn, mx] = f.value || ['', '']; const n = Number(v); return (mn === '' || n >= Number(mn)) && (mx === '' || n <= Number(mx)); }
    if (f.type === 'date') { const [from, to] = f.value || ['', '']; const d = String(v || ''); return (!from || d >= from) && (!to || d <= to); }
    if (f.type === 'enum') return !f.value?.length || f.value.includes(v);
    return true;
  }));
}

// --- Flat node for virtualization ---
interface CardInfo { cardKey: string; depth: number; isFirst: boolean; isLast: boolean; }
interface FlatItem {
  id: string;
  type: 'group-header' | 'row' | 'placeholder';
  group?: GroupBucket;
  row?: Row<any>;
  depth: number;
  cardPath: string[];
  itemCards: CardInfo[];
  cachedHeight: number;
  groupFieldValues?: Record<string, any>; // For placeholder rows in groups
}

interface Props {
  room: string;
  currentUser: { id: string; name: string; color: string };
  columns: DataColumnDef[];
}

export default function CollaborativeTable({ room, currentUser, columns: colDefs }: Props) {
  const { data: rawData, updateCell, addRow, addRowsNear, deleteRow, deleteRows } = useCRDT(room, currentUser);

  // View persistence
  const { loadViewConfig, saveViewConfig, resetViewConfig } = useViewPersistence(room, currentUser.id);
  const [initialized, setInitialized] = useState(false);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [grouping, setGrouping] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // DT-C9: Column interaction state
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [columnOrder, setColumnOrder] = useState<string[]>(() => colDefs.map(c => c.id));
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [frozenColumnCount, setFrozenColumnCount] = useState(0);

  // DT-C10: Conditional formatting
  const [conditionalRules, setConditionalRules] = useState<ConditionalRule[]>([]);

  // DT-C11: Load persisted config on mount
  useEffect(() => {
    const stored = loadViewConfig();
    if (stored) {
      if (stored.filters?.length) setFilters(stored.filters);
      if (stored.groupBy?.length) setGrouping(stored.groupBy);
      if (stored.columnOrder?.length) setColumnOrder(stored.columnOrder);
      if (stored.columnSizing && Object.keys(stored.columnSizing).length) setColumnSizing(stored.columnSizing);
      if (stored.columnVisibility && Object.keys(stored.columnVisibility).length) setColumnVisibility(stored.columnVisibility);
      if (stored.frozenColumnCount) setFrozenColumnCount(stored.frozenColumnCount);
      if (stored.conditionalRules?.length) setConditionalRules(stored.conditionalRules);
    }
    setInitialized(true);
  }, []);

  // DT-C11: Auto-save on state changes
  useEffect(() => {
    if (!initialized) return;
    saveViewConfig({
      filters, groupBy: grouping, columnOrder, columnSizing, columnVisibility,
      frozenColumnCount, conditionalRules,
    });
  }, [filters, grouping, columnOrder, columnSizing, columnVisibility, frozenColumnCount, conditionalRules, initialized]);

  // Reset view
  const handleResetView = () => {
    resetViewConfig();
    setFilters([]);
    setGrouping([]);
    setColumnOrder(colDefs.map(c => c.id));
    setColumnSizing({});
    setColumnVisibility({});
    setFrozenColumnCount(0);
    setConditionalRules([]);
  };

  const filtered = useMemo(() => applyFilters(rawData, filters), [rawData, filters]);

  // Compile conditional rules
  const evaluateConditionalRule = useMemo(() => compileConditionalRules(conditionalRules), [conditionalRules]);

  // Get visible column defs in order
  const orderedColDefs = useMemo(() => {
    const orderMap = new Map(columnOrder.map((id, i) => [id, i]));
    return [...colDefs]
      .sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999))
      .filter(c => columnVisibility[c.id] !== false);
  }, [colDefs, columnOrder, columnVisibility]);

  const tanCols = useMemo(() => orderedColDefs.map(cd =>
    columnHelper.accessor(cd.formula ? () => null : cd.id, {
      id: cd.id, header: cd.header, cell: ReactiveCell,
      meta: { colDef: cd },
      sortingFn: cd.type === 'number' ? 'basic' : 'alphanumeric',
      enableSorting: cd.sortable !== false,
      size: typeof cd.width === 'number' ? cd.width : 150,
    })
  ), [orderedColDefs]);

  const table = useReactTable({
    data: filtered, columns: tanCols,
    state: { sorting, columnSizing, columnVisibility },
    onSortingChange: setSorting,
    columnResizeMode: 'onChange',
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getFilteredRowModel: getFilteredRowModel(),
    meta: {
      updateData: updateCell, selectedCell, setSelectedCell,
      editingCell, setEditingCell,
      evaluateConditionalRule,
      refocusTable: () => tableRef.current?.focus(),
    },
  });

  const tableRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const { rows } = table.getRowModel();
  const groups = useMemo(() => grouping.length > 0 ? bucketize(rows, grouping, colDefs) : null, [rows, grouping, colDefs]);
  const toggle = useCallback((k: string) => setCollapsed(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; }), []);

  const CARD_GAP = 8;
  const CARD_INDENT = 16;
  const cardLeftMargin = (d: number) => d * CARD_INDENT;
  const CARD_LEVEL_OFFSET = CARD_INDENT + 1;

  // --- Flatten groups to virtual items ---
  const vItems = useMemo<FlatItem[]>(() => {
    type TempNode = { id: string; type: 'group-header' | 'row' | 'placeholder'; group?: GroupBucket; row?: Row<any>; depth: number; cardPath: string[]; groupFieldValues?: Record<string, any>; };
    const out: TempNode[] = [];
    let counter = 0;

    const walk = (gs: GroupBucket[], d: number, parentCardPath: string[], parentGroupFields: Record<string, any> = {}) => {
      gs.forEach(g => {
        const cardKey = `card-${d}-${g.key}`;
        const cardPath = d >= 1 ? [...parentCardPath, cardKey] : parentCardPath;
        const groupFields = { ...parentGroupFields, [g.fieldId]: g.value };
        out.push({ id: `g-${counter++}`, type: 'group-header', group: g, depth: d, cardPath });
        if (!collapsed.has(g.key)) {
          if (g.subGroups) {
            walk(g.subGroups, d + 1, cardPath, groupFields);
          } else {
            g.rows.forEach(r => out.push({ id: `r-${counter++}`, type: 'row', row: r, depth: d, cardPath }));
            // Placeholder row at group bottom
            out.push({ id: `p-${counter++}`, type: 'placeholder', depth: d, cardPath, groupFieldValues: groupFields });
          }
        }
      });
    };

    if (groups) {
      walk(groups, 0, []);
    } else {
      rows.forEach(r => out.push({ id: `r-${counter++}`, type: 'row', row: r, depth: 0, cardPath: [] }));
    }

    // Global placeholder row at the end
    out.push({ id: `p-global`, type: 'placeholder', depth: 0, cardPath: [] });

    // Compute isFirst/isLast for each card at each position + pre-compute heights
    const withCards = out.map((item, i) => {
      const prev = i > 0 ? out[i - 1] : null;
      const next = i < out.length - 1 ? out[i + 1] : null;
      const itemCards = item.cardPath.map((ck, idx) => ({
        cardKey: ck,
        depth: idx + 1,
        isFirst: !prev || !prev.cardPath.includes(ck),
        isLast: !next || !next.cardPath.includes(ck),
      }));
      return { ...item, itemCards, cachedHeight: 0 };
    });
    // Pre-compute estimateSize for each item
    for (let i = 0; i < withCards.length; i++) {
      const v = withCards[i];
      const nextV = i < withCards.length - 1 ? withCards[i + 1] : null;
      let h = v.type === 'group-header' ? (v.depth === 0 ? 44 : 40) : v.type === 'placeholder' ? 36 : 40;
      if (v.type === 'group-header' && v.depth >= 1) h += CARD_GAP;
      const needsBottomGap = v.itemCards.some(c => c.isLast) && (!nextV || nextV.depth === 0);
      if (needsBottomGap) h += CARD_GAP;
      v.cachedHeight = h;
    }
    return withCards;
  }, [groups, rows, collapsed]);

  // Keyboard navigation — precompute O(1) lookup map
  const rowIdToIndex = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < vItems.length; i++) {
      const item = vItems[i];
      if (item.type === 'row' && item.row?.original?._id) {
        map.set(item.row.original._id, i);
      }
    }
    return map;
  }, [vItems]);

  const getRowId = useCallback((rowIndex: number): string | null => {
    const item = vItems[rowIndex];
    return item?.row?.original?._id ?? null;
  }, [vItems]);

  const getRowIndex = useCallback((rowId: string): number => {
    return rowIdToIndex.get(rowId) ?? -1;
  }, [rowIdToIndex]);

  const isPlaceholderRow = useCallback((rowIndex: number): boolean => {
    const item = vItems[rowIndex];
    return !item || item.type !== 'row';
  }, [vItems]);

  const virtualizer = useVirtualizer({
    count: vItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: i => vItems[i]?.cachedHeight ?? 40,
    overscan: 25,
  });

  const { handleKeyDown } = useKeyboardNav({
    flatRowCount: vItems.length,
    columns: orderedColDefs,
    selectedCell,
    setSelectedCell,
    isEditing: !!editingCell,
    setEditingCell,
    getRowId,
    getRowIndex,
    scrollToIndex: (idx) => virtualizer.scrollToIndex(idx, { align: 'auto' }),
    isPlaceholderRow,
    refocusTable: () => tableRef.current?.focus(),
  });

  // DT-C8: Row operations
  const handleAddRow = useCallback((groupFieldValues?: Record<string, any>) => {
    const rowId = addRow(groupFieldValues);
    // Focus the new row after a short delay (let Yjs sync)
    setTimeout(() => {
      const firstEditableCol = orderedColDefs.find(c => c.editable !== false && !c.formula);
      if (firstEditableCol) {
        setSelectedCell({ rowId, colId: firstEditableCol.id });
        setEditingCell({ rowId, colId: firstEditableCol.id });
      }
    }, 50);
  }, [addRow, orderedColDefs]);

  const handleInsertRows = useCallback((anchorRowId: string, position: 'before' | 'after', count: number) => {
    // Inherit group field values from the anchor row so new rows stay in the same group
    const anchorRow = rawData.find(r => r._id === anchorRowId);
    const groupDefaults: Record<string, any> = {};
    if (anchorRow && grouping.length > 0) {
      grouping.forEach(fieldId => {
        if (anchorRow[fieldId] !== undefined) {
          groupDefaults[fieldId] = anchorRow[fieldId];
        }
      });
    }
    const ids = addRowsNear(anchorRowId, position, count, Object.keys(groupDefaults).length > 0 ? groupDefaults : undefined);
    if (ids.length > 0) {
      const firstEditableCol = orderedColDefs.find(c => c.editable !== false && !c.formula);
      if (firstEditableCol) {
        setTimeout(() => {
          setSelectedCell({ rowId: ids[0], colId: firstEditableCol.id });
        }, 50);
      }
    }
  }, [addRowsNear, orderedColDefs, rawData, grouping]);

  const toggleRowSelection = useCallback((rowId: string, isShift = false) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  // DT-C9: Auto-fit all columns
  const handleAutoFitAll = useCallback(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.font = '14px sans-serif';

    const newSizing: ColumnSizingState = {};
    orderedColDefs.forEach(col => {
      let maxWidth = ctx.measureText(col.header).width + 32; // header width + padding
      // Measure visible data
      const visibleItems = virtualizer.getVirtualItems();
      visibleItems.forEach(vi => {
        const item = vItems[vi.index];
        if (item?.type === 'row' && item.row) {
          const val = item.row.original[col.id];
          const textWidth = ctx.measureText(String(val ?? '')).width + 32;
          maxWidth = Math.max(maxWidth, textWidth);
        }
      });
      newSizing[col.id] = Math.max(60, Math.min(400, Math.ceil(maxWidth)));
    });
    setColumnSizing(newSizing);
  }, [orderedColDefs, vItems, virtualizer]);

  // DT-C9: Column header context menu handlers
  const handleFreezeColumn = useCallback((colId: string) => {
    const idx = orderedColDefs.findIndex(c => c.id === colId);
    if (idx >= 0) {
      setFrozenColumnCount(prev => prev === idx + 1 ? 0 : idx + 1);
    }
  }, [orderedColDefs]);

  const handleHideColumn = useCallback((colId: string) => {
    const visibleCount = orderedColDefs.filter(c => columnVisibility[c.id] !== false).length;
    if (visibleCount <= 1) return;
    setColumnVisibility(prev => ({ ...prev, [colId]: false }));
  }, [orderedColDefs, columnVisibility]);

  // Compute frozen column offsets for sticky positioning
  const frozenOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let cumulative = 0;
    for (let i = 0; i < frozenColumnCount && i < orderedColDefs.length; i++) {
      const col = orderedColDefs[i];
      offsets[col.id] = cumulative;
      const size = columnSizing[col.id] || (typeof col.width === 'number' ? col.width : 150);
      cumulative += size;
    }
    return offsets;
  }, [frozenColumnCount, orderedColDefs, columnSizing]);

  // Conditional rules indicator: which columns have rules
  const columnsWithRules = useMemo(() => {
    const map = new Map<string, string[]>();
    conditionalRules.forEach(r => {
      if (!map.has(r.columnId)) map.set(r.columnId, []);
      map.get(r.columnId)!.push(r.style.backgroundColor);
    });
    return map;
  }, [conditionalRules]);

  const colSizes = orderedColDefs.map(cd => columnSizing[cd.id] || (typeof cd.width === 'number' ? cd.width : 150));
  const gridCols = colSizes.map(s => `${s}px`).join(' ');
  const totalWidth = colSizes.reduce((a, b) => a + b, 0);
  // Card wrappers add 16px left + 16px right margin per nesting level
  // scrollContentWidth = grid width + all card margins so grids fit inside cards
  const maxCardExtraWidth = Math.max(0, grouping.length - 1) * 32;
  const scrollContentWidth = totalWidth + maxCardExtraWidth;

  if (rawData.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium">正在同步数据…</p>
        </div>
      </div>
    );
  }

  // --- Shared render helpers ---
  const renderEnumBadge = (enumOpt: any, size: 'sm' | 'xs' = 'sm') => (
    <Badge variant="secondary"
      className={size === 'sm' ? 'text-[10px] font-bold tracking-widest uppercase px-1.5 py-0 border-0' : 'text-[10px] font-bold tracking-wider uppercase px-1 py-0 border-0'}
      style={(enumOpt.color && enumOpt.color.startsWith('var(')) ? { backgroundColor: `oklch(${enumOpt.color} / 0.15)`, color: `oklch(${enumOpt.color})` } : {}}
    >
      {enumOpt.label}
    </Badge>
  );

  // --- Card border wrapper ---
  const wrapWithCards = (content: React.ReactNode, itemCards: CardInfo[]) => {
    let wrapped = content;
    for (let c = itemCards.length - 1; c >= 0; c--) {
      const card = itemCards[c];
      const ml = c === 0 ? cardLeftMargin(card.depth) : 16;
      const mr = 16;
      const prev = wrapped;
      wrapped = (
        <div style={{
          marginLeft: ml, marginRight: mr,
          borderLeft: '1px solid var(--border)',
          borderRight: '1px solid var(--border)',
          ...(card.isLast ? {
            borderBottom: '1px solid var(--border)',
            borderRadius: '0 0 0.5rem 0.5rem',
            paddingBottom: CARD_GAP,
          } : {}),
        }}>
          {prev}
        </div>
      );
    }
    return wrapped;
  };

  // --- Placeholder row renderer ---
  const renderPlaceholderRow = (item: FlatItem, gridCols: string) => (
    <div
      className="flex items-center hover:bg-accent/20 transition-colors cursor-pointer group"
      style={{ display: 'grid', gridTemplateColumns: gridCols, height: 36 }}
      onClick={() => handleAddRow(item.groupFieldValues)}
    >
      <div className="flex items-center pl-3">
        <span className="text-muted-foreground/40 group-hover:text-primary transition-colors text-lg leading-none">+</span>
      </div>
      {orderedColDefs.slice(1).map(col => (
        <div key={col.id} className="border-b border-dashed border-border/30 h-full" />
      ))}
    </div>
  );

  // Build frozen cell style
  const getFrozenStyle = (colId: string): React.CSSProperties => {
    if (frozenOffsets[colId] !== undefined) {
      return {
        position: 'sticky',
        left: frozenOffsets[colId],
        zIndex: 2,
        backgroundColor: 'inherit',
      };
    }
    return {};
  };

  // Is this the last frozen column (needs separator)?
  const isLastFrozenCol = (colId: string): boolean => {
    return frozenColumnCount > 0 && orderedColDefs[frozenColumnCount - 1]?.id === colId;
  };

  return (
    <div ref={tableRef} className="flex flex-col h-full bg-background relative" tabIndex={0} onKeyDown={handleKeyDown} style={{ outline: 'none' }}>
      {/* Extracted Compact Toolbar Row */}
      <div className="px-3 py-1.5 border-b shadow-sm flex items-center gap-2 shrink-0 z-30 bg-muted/30 flex-wrap relative">
        <FilterPanel columns={colDefs} filters={filters} onFiltersChange={setFilters} />
        <div className="w-px h-4 bg-border/50 mx-1" />
        <GroupToolbar columns={colDefs} grouping={grouping} onGroupingChange={setGrouping} />
        <div className="w-px h-4 bg-border/50 mx-1" />
        <ConditionalFormatPanel columns={colDefs} rules={conditionalRules} onRulesChange={setConditionalRules} />
        <div className="w-px h-4 bg-border/50 mx-1" />
        <ColumnManager
          columns={colDefs}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          onAutoFitAll={handleAutoFitAll}
        />
        
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-r pr-3">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />{room}
            <span className="bg-background border px-1.5 py-0.5 rounded shadow-sm tabular-nums ml-2">{filtered.length.toLocaleString()} 行</span>
          </div>
          
          <Button variant="ghost" size="sm" className="text-xs h-7 px-2 hover:bg-accent/50 text-muted-foreground" onClick={handleResetView}>
            重置视图
          </Button>

          <Button variant="default" size="sm" className="gap-1.5 h-7 rounded bg-primary hover:bg-primary/90 text-primary-foreground border-0 shadow-none font-medium px-3" onClick={() => handleAddRow()}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            添加行
          </Button>
        </div>
      </div>

      {/* Scrollable table area (header + body share one scroll container) */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        {/* Sticky Header */}
        <div className="sticky top-0 border-b bg-background z-20" style={{ minWidth: scrollContentWidth }}>
          {table.getHeaderGroups().map(hg => (
            <div key={hg.id} style={{
              display: 'grid', gridTemplateColumns: gridCols,
              paddingLeft: Math.max(0, grouping.length - 1) * CARD_LEVEL_OFFSET,
            }}>
              {hg.headers.map(header => {
                const cd = colDefs.find(c => c.id === header.id);
                const isFormula = !!cd?.formula;
                const ruleColors = columnsWithRules.get(header.id);
                const frozen = getFrozenStyle(header.id);
                const lastFrozen = isLastFrozenCol(header.id);

                return (
                  <ContextMenu key={header.id}>
                    <ContextMenuTrigger asChild>
                      <div
                        className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap relative transition-colors ${header.column.getIsSorted() ? 'text-primary bg-primary/[0.03]' : 'text-muted-foreground bg-background'} ${lastFrozen ? 'border-r-2 border-primary/20' : ''}`}
                        style={frozen}
                      >
                        <div className="flex items-center gap-1.5">
                          {!header.isPlaceholder && (
                            <div
                              className={header.column.getCanSort() ? 'cursor-pointer select-none hover:text-foreground transition-colors flex items-center gap-1' : 'flex items-center gap-1'}
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {isFormula && cd?.formulaExpression && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-indigo-100 text-indigo-600 text-[9px] font-bold cursor-help shrink-0">ƒx</span>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="text-xs max-w-[250px]">
                                    计算公式: {cd.formulaExpression}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {isFormula && !cd?.formulaExpression && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-indigo-100 text-indigo-600 text-[9px] font-bold cursor-help shrink-0">ƒx</span>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                                    公式计算列：基于同行其他字段自动计算，不可编辑
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              <span className="text-primary text-[10px]">
                                {{ asc: '▲', desc: '▼' }[header.column.getIsSorted() as string] ?? ''}
                              </span>
                            </div>
                          )}
                          {/* Conditional format indicators */}
                          {ruleColors && ruleColors.length > 0 && (
                            <div className="flex items-center gap-0.5 ml-1">
                              {ruleColors.slice(0, 3).map((c, i) => (
                                <span key={i} className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c }} />
                              ))}
                              {ruleColors.length > 3 && <span className="text-[8px] text-muted-foreground">+{ruleColors.length - 3}</span>}
                            </div>
                          )}
                        </div>

                        {/* Column resize handle */}
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          onDoubleClick={() => {
                            // Auto-fit single column
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');
                            if (!ctx) return;
                            ctx.font = '14px sans-serif';
                            let maxWidth = ctx.measureText(cd?.header || '').width + 32;
                            virtualizer.getVirtualItems().forEach(vi => {
                              const item = vItems[vi.index];
                              if (item?.type === 'row' && item.row) {
                                const val = item.row.original[header.id];
                                maxWidth = Math.max(maxWidth, ctx.measureText(String(val ?? '')).width + 32);
                              }
                            });
                            setColumnSizing(prev => ({ ...prev, [header.id]: Math.max(60, Math.ceil(maxWidth)) }));
                          }}
                          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/30 transition-colors ${header.column.getIsResizing() ? 'bg-primary/50' : ''}`}
                        />
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-[180px]">
                      <ContextMenuItem onClick={() => handleHideColumn(header.id)}>
                        <svg className="w-3.5 h-3.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        隐藏此列
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => handleFreezeColumn(header.id)}>
                        <svg className="w-3.5 h-3.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        {frozenOffsets[header.id] !== undefined ? '取消冻结' : '冻结至此列'}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })}
            </div>
          ))}
        </div>

        {/* Virtual Body */}
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative', minWidth: scrollContentWidth }}>
          {virtualizer.getVirtualItems().map(vi => {
            const item = vItems[vi.index];
            const { itemCards } = item;
            const inCard = itemCards.length > 0;

            // --- Placeholder Row ---
            if (item.type === 'placeholder') {
              const nextItem = vi.index < vItems.length - 1 ? vItems[vi.index + 1] : null;
              const needsBottomGap = itemCards.some(c => c.isLast) && (!nextItem || nextItem.depth === 0);

              if (inCard) {
                const innerML = item.depth >= 2 ? 16 : cardLeftMargin(item.depth);
                const innerMR = 16;
                const placeholderContent = (
                  <div style={{ marginLeft: innerML, marginRight: innerMR,
                    borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)',
                    borderBottom: '1px solid var(--border)', borderRadius: '0 0 0.5rem 0.5rem',
                  }}>
                    {renderPlaceholderRow(item, gridCols)}
                  </div>
                );
                const parentCards = itemCards.slice(0, -1);
                return (
                  <div key={item.id} ref={virtualizer.measureElement} data-index={vi.index}
                    className="absolute w-full"
                    style={{ top: 0, transform: `translateY(${vi.start}px)`, paddingBottom: needsBottomGap ? CARD_GAP : 0 }}
                  >
                    {parentCards.length > 0 ? wrapWithCards(placeholderContent, parentCards) : placeholderContent}
                  </div>
                );
              }

              return (
                <div key={item.id} ref={virtualizer.measureElement} data-index={vi.index}
                  className="absolute w-full"
                  style={{ top: 0, transform: `translateY(${vi.start}px)` }}
                >
                  <div className="border-b border-dashed border-border/30">
                    {renderPlaceholderRow(item, gridCols)}
                  </div>
                </div>
              );
            }

            // --- Group Header ---
            if (item.type === 'group-header' && item.group) {
              const { group, depth } = item;
              const isL1 = depth === 0;
              const isCollapsed = collapsed.has(group.key);
              const count = group.subGroups
                ? group.subGroups.reduce((s, g) => s + g.rows.length, 0)
                : group.rows.length;
              const enumOpt = group.colDef?.type === 'enum'
                ? group.colDef.enumOptions?.find(o => o.value === group.value) : null;

              if (isL1) {
                return (
                  <div key={item.id} ref={virtualizer.measureElement} data-index={vi.index}
                    className="absolute w-full cursor-pointer"
                    style={{ top: 0, transform: `translateY(${vi.start}px)` }}
                    onClick={() => toggle(group.key)}
                  >
                    <div className="flex items-center gap-3 px-4 h-[44px] bg-muted/60 border-b"
                      style={{ position: 'sticky', left: 0, minWidth: 'fit-content' }}
                    >
                      <span className={`text-xs text-muted-foreground transition-transform ${isCollapsed ? '' : 'rotate-90'}`}>▶</span>
                      <span className="text-xs font-semibold text-muted-foreground uppercase">{group.colDef?.header || group.fieldId}</span>
                      {enumOpt ? renderEnumBadge(enumOpt) : <span className="text-sm font-medium">{String(group.value)}</span>}
                      <span className="text-xs text-muted-foreground">({count})</span>
                    </div>
                  </div>
                );
              }

              // L2/L3 card header
              const parentCards = itemCards.slice(0, -1);
              const innerML = depth >= 2 ? 16 : cardLeftMargin(depth);
              const innerMR = 16;
              const headerContent = (
                <div style={{ marginLeft: innerML, marginRight: innerMR, paddingTop: CARD_GAP }}>
                  <div className={`flex items-center gap-2.5 px-3 py-2 border bg-card ${isCollapsed ? 'rounded-lg' : 'rounded-t-lg'}`}>
                    <span className={`text-[10px] text-muted-foreground transition-transform ${isCollapsed ? '' : 'rotate-90'}`}>▶</span>
                    <span className="text-xs text-muted-foreground">{group.colDef?.header}:</span>
                    {enumOpt ? renderEnumBadge(enumOpt, 'xs') : <span className="text-xs font-medium">{String(group.value)}</span>}
                    <span className="text-[10px] text-muted-foreground">({count})</span>
                  </div>
                </div>
              );

              const nextItem = vi.index < vItems.length - 1 ? vItems[vi.index + 1] : null;
              const needsBottomGap = itemCards.some(c => c.isLast) && (!nextItem || nextItem.depth === 0);

              return (
                <div key={item.id} ref={virtualizer.measureElement} data-index={vi.index}
                  className="absolute w-full cursor-pointer"
                  style={{ top: 0, transform: `translateY(${vi.start}px)`, paddingBottom: needsBottomGap ? CARD_GAP : 0 }}
                  onClick={() => toggle(group.key)}
                >
                  {parentCards.length > 0 ? wrapWithCards(headerContent, parentCards) : headerContent}
                </div>
              );
            }

            // --- Data Row ---
            if (item.type === 'row' && item.row) {
              const row = item.row;
              const innermostCard = itemCards.length > 0 ? itemCards[itemCards.length - 1] : null;
              const isLastInInnermostCard = !!innermostCard?.isLast;
              const nextItem = vi.index < vItems.length - 1 ? vItems[vi.index + 1] : null;
              const needsBottomGap = itemCards.some(c => c.isLast) && (!nextItem || nextItem.depth === 0);
              const isRowSelected = selectedRowIds.has(row.original._id);

              const rowContent = (colsGrid: string, extraClass = '', extraStyle: React.CSSProperties = {}) => (
                <RowContextMenu
                  rowId={row.original._id}
                  rowIndex={vi.index}
                  selectedRowIds={selectedRowIds}
                  onInsertRows={handleInsertRows}
                  onDeleteRow={deleteRow}
                  onDeleteRows={deleteRows}
                >
                  <div
                    className={`transition-colors ${isRowSelected ? 'bg-primary/5' : ''} ${extraClass}`}
                    style={{ display: 'grid', gridTemplateColumns: colsGrid, height: 40, ...extraStyle }}
                  >
                    {row.getVisibleCells().map((cell: any) => {
                      const colId = cell.column.id;
                      const frozenStyle = getFrozenStyle(colId);
                      const lastFrozen = isLastFrozenCol(colId);
                      return (
                        <div key={cell.id}
                          className={`overflow-hidden border-r border-border/30 last:border-0 flex items-center ${lastFrozen ? 'border-r-2 !border-primary/20' : ''}`}
                          style={frozenStyle}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      );
                    })}
                  </div>
                </RowContextMenu>
              );

              if (inCard) {
                const innerML = item.depth >= 2 ? 16 : cardLeftMargin(item.depth);
                const innerMR = 16;

                const cardRowContent = (
                  <div
                    style={{
                      marginLeft: innerML, marginRight: innerMR,
                      borderLeft: '1px solid var(--border)',
                      borderRight: '1px solid var(--border)',
                      borderBottom: '1px solid var(--border)',
                      ...(isLastInInnermostCard ? {} : {}),
                    }}
                  >
                    {rowContent(gridCols, `bg-card`)}
                  </div>
                );

                const parentCards = itemCards.slice(0, -1);
                return (
                  <div key={item.id} ref={virtualizer.measureElement} data-index={vi.index}
                    className="absolute w-full"
                    style={{ top: 0, transform: `translateY(${vi.start}px)`, paddingBottom: needsBottomGap ? CARD_GAP : 0 }}
                  >
                    {parentCards.length > 0 ? wrapWithCards(cardRowContent, parentCards) : cardRowContent}
                  </div>
                );
              }

              // Non-card row
              return (
                <div key={item.id} ref={virtualizer.measureElement} data-index={vi.index}
                  className="absolute w-full"
                  style={{ top: 0, transform: `translateY(${vi.start}px)` }}
                >
                  {rowContent(gridCols, 'border-b border-border/50 hover:bg-accent/30')}
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>
    </div>
  );
}
