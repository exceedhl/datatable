import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAwarenessStore } from './useAwareness';
import { formatNumber } from './formatNumber';
import type { DataColumnDef } from './types';
import { useShallow } from 'zustand/react/shallow';

export function ReactiveCell({ getValue, row, column, table }: any) {
  const colDef: DataColumnDef | undefined = column.columnDef.meta?.colDef;
  const colType = colDef?.type || 'string';

  const rawValue = colDef?.formula ? colDef.formula(row.original) : getValue();
  const [value, setValue] = useState(rawValue);
  const [isEditing, setIsEditing] = useState(false);

  const updateData = table.options.meta?.updateData;
  const selectedCell = table.options.meta?.selectedCell;
  const setSelectedCell = table.options.meta?.setSelectedCell;
  const editingCell = table.options.meta?.editingCell;
  const setEditingCell = table.options.meta?.setEditingCell;
  const evaluateConditionalRule = table.options.meta?.evaluateConditionalRule;
  const refocusTable = table.options.meta?.refocusTable;
  const rowId = row.original._id;
  const colId = column.id;

  const cellEditorOverride = colDef?.cellEditor;
  const isEditable = colDef?.editable !== false && !colDef?.formula;
  const isSelected = selectedCell?.rowId === rowId && selectedCell?.colId === colId;

  // Keyboard-driven editing
  const isEditingViaKeyboard = editingCell?.rowId === rowId && editingCell?.colId === colId;

  // Consolidated effect: keyboard editing, value sync, and deselection
  useEffect(() => {
    // Enter edit mode via keyboard
    if (isEditingViaKeyboard && isEditable && !isEditing) {
      setIsEditing(true);
      return;
    }
    // Exit edit mode when another cell is selected
    if (isEditing && !isSelected) {
      setIsEditing(false);
      if (value !== rawValue) updateData?.(rowId, colId, value);
      if (isEditingViaKeyboard) setEditingCell?.(null);
      return;
    }
    // Sync value from external source when not editing
    if (!isEditing) {
      const v = colDef?.formula ? colDef.formula(row.original) : getValue();
      setValue(v);
    }
  }, [isEditingViaKeyboard, isSelected, getValue(), row.original, isEditing]);

  const onClick = () => setSelectedCell?.({ rowId, colId });
  const onDoubleClick = () => { if (isEditable) { setIsEditing(true); setEditingCell?.({ rowId, colId }); } };

  const onBlur = () => {
    setIsEditing(false);
    if (value !== rawValue) updateData?.(rowId, colId, value);
    setEditingCell?.(null);
    refocusTable?.();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { onBlur(); }
    else if (e.key === 'Escape') { setValue(rawValue); setIsEditing(false); setEditingCell?.(null); refocusTable?.(); }
  };

  // Awareness — fine-grained selector: only re-render when this specific cell's cursors change
  const cellCursors = useAwarenessStore(
    useShallow((s: any) => {
      const matches: any[] = [];
      for (const c of Object.values(s.activeCursors)) {
        if ((c as any).rowId === rowId && (c as any).colId === colId) matches.push(c);
      }
      return matches;
    })
  );
  const hasExternalCursor = cellCursors.length > 0;
  const primaryCursor = cellCursors[0];

  // Custom editor (DT-C6)
  if (isEditing && cellEditorOverride) {
    return cellEditorOverride({
      rowData: row.original, columnDef: colDef!, value,
      onCommit: (p: any) => { updateData?.(rowId, colId, p); setIsEditing(false); setEditingCell?.(null); },
      onCancel: () => { setIsEditing(false); setEditingCell?.(null); },
    });
  }

  // Conditional highlight: prop-based (legacy) then rule-based
  let highlightColor = colDef?.highlight?.(value, row.original) || null;
  if (!highlightColor && evaluateConditionalRule) {
    highlightColor = evaluateConditionalRule(colId, value);
  }

  // Number formatting for display
  const displayValue = (() => {
    if (colType === 'number' && colDef?.numberFormat && !isEditing) {
      return formatNumber(value, colDef.numberFormat);
    }
    return value;
  })();

  // Border style
  const borderClass = isSelected || isEditing
    ? 'ring-2 ring-primary ring-inset'
    : hasExternalCursor
      ? 'ring-2 ring-inset'
      : '';

  return (
    <div
      className={`relative w-full h-full min-h-[36px] flex items-center px-3 py-1 cursor-pointer select-none transition-colors duration-100 ${borderClass}`}
      style={{
        ...(hasExternalCursor && !isSelected ? { '--tw-ring-color': primaryCursor.color } as any : {}),
        ...(highlightColor ? { backgroundColor: highlightColor } : {}),
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {isEditing ? (
        colType === 'enum' && colDef?.enumOptions ? (
          <Select value={String(value ?? '')} onValueChange={v => { setValue(v); updateData?.(rowId, colId, v); setIsEditing(false); setEditingCell?.(null); refocusTable?.(); }} onOpenChange={open => { if (!open) { setIsEditing(false); setEditingCell?.(null); refocusTable?.(); } }}>
            <SelectTrigger size="sm" className="w-full h-7 border-none shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              {colDef.enumOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : colType === 'number' ? (
          <input autoFocus type="number"
            className="w-full h-7 bg-transparent outline-none text-sm"
            value={value ?? ''} onChange={e => setValue(Number(e.target.value))} onBlur={onBlur} onKeyDown={onKeyDown}
            min={colDef?.numberRange?.min} max={colDef?.numberRange?.max} step={colDef?.numberRange?.step}
          />
        ) : colType === 'date' ? (
          <input autoFocus type="date"
            className="w-full h-7 bg-transparent outline-none text-sm"
            value={value ?? ''} onChange={e => setValue(e.target.value)}
            onBlur={onBlur}
            onKeyDown={e => {
              // Let arrow keys work natively in the date picker without navigating cells
              if (e.key.startsWith('Arrow')) { e.stopPropagation(); return; }
              onKeyDown(e);
            }}
          />
        ) : (
          <input autoFocus type="text"
            className="w-full h-7 bg-transparent outline-none text-sm"
            value={value ?? ''} onChange={e => setValue(e.target.value)} onBlur={onBlur} onKeyDown={onKeyDown}
          />
        )
      ) : (
        colType === 'enum' ? (() => {
          const opt = colDef?.enumOptions?.find(o => o.value === value);
          return opt ? (
            <Badge variant="secondary" className="text-[11px] font-medium" style={opt.color ? { backgroundColor: opt.color, color: parseInt(opt.color.slice(1), 16) < 0x888888 ? '#fff' : '#1e293b' } : {}}>
              {opt.label}
            </Badge>
          ) : <span className="text-sm text-muted-foreground truncate">{value}</span>;
        })() : colDef?.formula ? (
          <span className="truncate text-sm text-indigo-600">{displayValue}</span>
        ) : colType === 'number' ? (
          <span className="truncate text-sm tabular-nums">{displayValue}</span>
        ) : colType === 'date' ? (
          <span className="truncate text-sm text-muted-foreground">{displayValue}</span>
        ) : (
          <span className="truncate text-sm">{displayValue}</span>
        )
      )}

      {hasExternalCursor && !isEditing && !isSelected && (
        <div className="absolute -top-3 -right-1 text-[10px] text-white px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap z-10 pointer-events-none font-medium" style={{ backgroundColor: primaryCursor.color }}>
          {primaryCursor.name}
        </div>
      )}
    </div>
  );
}
