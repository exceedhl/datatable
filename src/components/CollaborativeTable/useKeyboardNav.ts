import { useCallback, useRef, useEffect } from 'react';
import type { DataColumnDef } from './types';

interface KeyboardNavOptions {
  flatRowCount: number;
  columns: DataColumnDef[];
  selectedCell: { rowId: string; colId: string } | null;
  setSelectedCell: (cell: { rowId: string; colId: string } | null) => void;
  isEditing: boolean;
  setEditingCell: (cell: { rowId: string; colId: string } | null) => void;
  getRowId: (rowIndex: number) => string | null;
  getRowIndex: (rowId: string) => number;
  scrollToIndex: (index: number) => void;
  isPlaceholderRow: (rowIndex: number) => boolean;
  refocusTable: () => void;
}

export function useKeyboardNav({
  flatRowCount,
  columns,
  selectedCell,
  setSelectedCell,
  isEditing,
  setEditingCell,
  getRowId,
  getRowIndex,
  scrollToIndex,
  isPlaceholderRow,
  refocusTable,
}: KeyboardNavOptions) {
  const visibleCols = columns.filter(c => c.type !== undefined); // all defined columns
  const editableCols = columns.filter(c => c.editable !== false && !c.formula);

  const getColIndex = (colId: string) => visibleCols.findIndex(c => c.id === colId);

  // Use refs for values that change frequently so handleKeyDown doesn't need to be recreated
  const selectedCellRef = useRef(selectedCell);
  const isEditingRef = useRef(isEditing);
  const flatRowCountRef = useRef(flatRowCount);
  const visibleColsRef = useRef(visibleCols);
  const editableColsRef = useRef(editableCols);

  useEffect(() => { selectedCellRef.current = selectedCell; }, [selectedCell]);
  useEffect(() => { isEditingRef.current = isEditing; }, [isEditing]);
  useEffect(() => { flatRowCountRef.current = flatRowCount; }, [flatRowCount]);
  useEffect(() => { visibleColsRef.current = visibleCols; }, [visibleCols]);
  useEffect(() => { editableColsRef.current = editableCols; }, [editableCols]);

  const findNextDataRow = (fromIndex: number, direction: 1 | -1): number => {
    const count = flatRowCountRef.current;
    let idx = fromIndex + direction;
    while (idx >= 0 && idx < count) {
      if (!isPlaceholderRow(idx)) return idx;
      idx += direction;
    }
    return fromIndex; // stay if no valid row found
  };

  const findNextEditableCol = (fromColIndex: number, direction: 1 | -1): number => {
    const cols = visibleColsRef.current;
    let idx = fromColIndex + direction;
    while (idx >= 0 && idx < cols.length) {
      const col = cols[idx];
      if (col.editable !== false && !col.formula) return idx;
      idx += direction;
    }
    return -1; // no editable col found
  };

  // Stable handler - reads from refs, never stale
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const cell = selectedCellRef.current;
    if (!cell) return;

    const cols = visibleColsRef.current;
    const edCols = editableColsRef.current;
    const editing = isEditingRef.current;

    const currentRowIndex = getRowIndex(cell.rowId);
    const currentColIndex = cols.findIndex(c => c.id === cell.colId);
    if (currentRowIndex < 0 || currentColIndex < 0) return;

    const moveTo = (rowIndex: number, colIndex: number) => {
      const rowId = getRowId(rowIndex);
      if (rowId && colIndex >= 0 && colIndex < cols.length) {
        const newCell = { rowId, colId: cols[colIndex].id };
        setSelectedCell(newCell);
        selectedCellRef.current = newCell; // update ref immediately for rapid key repeat
        scrollToIndex(rowIndex);
        e.preventDefault();
      }
    };

    if (editing) {
      // In editing mode
      if (e.key === 'Enter' && !e.shiftKey) {
        // Commit and move down
        setEditingCell(null);
        const nextRow = findNextDataRow(currentRowIndex, 1);
        if (nextRow !== currentRowIndex) moveTo(nextRow, currentColIndex);
        e.preventDefault();
        requestAnimationFrame(() => refocusTable());
      } else if (e.key === 'Escape') {
        setEditingCell(null);
        e.preventDefault();
        requestAnimationFrame(() => refocusTable());
      } else if (e.key === 'Tab') {
        setEditingCell(null);
        const direction = e.shiftKey ? -1 : 1;
        let nextCol = findNextEditableCol(currentColIndex, direction as 1 | -1);
        if (nextCol < 0) {
          // Wrap to next/prev row
          const nextRow = findNextDataRow(currentRowIndex, direction as 1 | -1);
          if (nextRow !== currentRowIndex) {
            nextCol = direction === 1
              ? edCols.length > 0 ? cols.findIndex(c => c.id === edCols[0].id) : 0
              : edCols.length > 0 ? cols.findIndex(c => c.id === edCols[edCols.length - 1].id) : cols.length - 1;
            moveTo(nextRow, nextCol);
          }
        } else {
          moveTo(currentRowIndex, nextCol);
        }
        e.preventDefault();
        requestAnimationFrame(() => refocusTable());
      }
      return; // Other keys pass through to input
    }

    // Navigation mode (not editing)
    switch (e.key) {
      case 'ArrowUp': {
        const nextRow = findNextDataRow(currentRowIndex, -1);
        moveTo(nextRow, currentColIndex);
        break;
      }
      case 'ArrowDown': {
        const nextRow = findNextDataRow(currentRowIndex, 1);
        moveTo(nextRow, currentColIndex);
        break;
      }
      case 'ArrowLeft':
        if (currentColIndex > 0) moveTo(currentRowIndex, currentColIndex - 1);
        e.preventDefault();
        break;
      case 'ArrowRight':
        if (currentColIndex < cols.length - 1) moveTo(currentRowIndex, currentColIndex + 1);
        e.preventDefault();
        break;
      case 'Tab': {
        const direction = e.shiftKey ? -1 : 1;
        let nextCol = findNextEditableCol(currentColIndex, direction as 1 | -1);
        if (nextCol < 0) {
          const nextRow = findNextDataRow(currentRowIndex, direction as 1 | -1);
          if (nextRow !== currentRowIndex) {
            nextCol = direction === 1
              ? edCols.length > 0 ? cols.findIndex(c => c.id === edCols[0].id) : 0
              : edCols.length > 0 ? cols.findIndex(c => c.id === edCols[edCols.length - 1].id) : cols.length - 1;
            moveTo(nextRow, nextCol);
          }
        } else {
          moveTo(currentRowIndex, nextCol);
        }
        e.preventDefault();
        break;
      }
      case 'Enter': {
        const col = cols[currentColIndex];
        if (col && col.editable !== false && !col.formula) {
          setEditingCell({ rowId: cell.rowId, colId: cell.colId });
          e.preventDefault();
        }
        break;
      }
      case 'Delete':
      case 'Backspace':
        // Clear cell value — handled by parent
        break;
    }
  // Stable deps - functions from props that are themselves useCallback-wrapped
  // State values are read from refs, so no dependency on selectedCell/isEditing/etc.
  }, [getRowId, getRowIndex, isPlaceholderRow, setSelectedCell, setEditingCell, scrollToIndex, refocusTable]);

  return { handleKeyDown };
}
