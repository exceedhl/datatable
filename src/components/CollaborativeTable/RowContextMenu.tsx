import { useState, useRef, useEffect } from 'react';
import {
  ContextMenu, ContextMenuContent, ContextMenuSeparator, ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface RowContextMenuProps {
  children: React.ReactNode;
  rowId: string;
  rowIndex: number;
  selectedRowIds: Set<string>;
  onInsertRows: (anchorRowId: string, position: 'before' | 'after', count: number) => void;
  onDeleteRow: (rowId: string) => void;
  onDeleteRows: (rowIds: string[]) => void;
}

// Inline row item with number input — single click to insert
function InsertRowItem({
  icon, label, onInsert,
}: {
  icon: string; label: string;
  onInsert: (count: number) => void;
}) {
  const [count, setCount] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="flex items-center gap-2 px-2 py-2 text-sm cursor-pointer hover:bg-accent rounded-sm transition-colors"
      onClick={() => onInsert(count)}
    >
      <span className="text-base w-5 text-center shrink-0">{icon}</span>
      <span className="shrink-0">Insert</span>
      <input
        ref={inputRef}
        type="number" min={1} max={100} value={count}
        onChange={e => setCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onInsert(count); } }}
        className="w-10 h-6 rounded border border-input bg-background px-1 text-xs outline-none text-center tabular-nums"
      />
      <span className="shrink-0">{label}</span>
    </div>
  );
}

export function RowContextMenu({
  children, rowId, rowIndex, selectedRowIds,
  onInsertRows, onDeleteRow, onDeleteRows,
}: RowContextMenuProps) {
  const hasSelection = selectedRowIds.size > 0;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-[220px] p-1">
        <InsertRowItem
          icon="↑"
          label="Above"
          onInsert={(count) => onInsertRows(rowId, 'before', count)}
        />
        <InsertRowItem
          icon="↓"
          label="Below"
          onInsert={(count) => onInsertRows(rowId, 'after', count)}
        />

        <ContextMenuSeparator />

        {/* Delete this row */}
        <div
          className="flex items-center gap-2 px-2 py-2 text-sm cursor-pointer hover:bg-accent rounded-sm transition-colors text-destructive"
          onClick={() => onDeleteRow(rowId)}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          删除此行
        </div>

        {/* Delete selected rows */}
        {hasSelection && (
          <div
            className="flex items-center gap-2 px-2 py-2 text-sm cursor-pointer hover:bg-accent rounded-sm transition-colors text-destructive"
            onClick={() => {
              if (confirm(`确认删除 ${selectedRowIds.size} 条记录？此操作不可撤销。`)) {
                onDeleteRows(Array.from(selectedRowIds));
              }
            }}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            删除选中行 ({selectedRowIds.size})
          </div>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
