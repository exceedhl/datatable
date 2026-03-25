import { useCallback } from 'react';
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
}: KeyboardNavOptions) {
  const visibleCols = columns.filter(c => c.type !== undefined); // all defined columns
  const editableCols = columns.filter(c => c.editable !== false && !c.formula);

  const getColIndex = (colId: string) => visibleCols.findIndex(c => c.id === colId);

  const findNextDataRow = (fromIndex: number, direction: 1 | -1): number => {
    let idx = fromIndex + direction;
    while (idx >= 0 && idx < flatRowCount) {
      if (!isPlaceholderRow(idx)) return idx;
      idx += direction;
    }
    return fromIndex; // stay if no valid row found
  };

  const findNextEditableCol = (fromColIndex: number, direction: 1 | -1): number => {
    let idx = fromColIndex + direction;
    while (idx >= 0 && idx < visibleCols.length) {
      const col = visibleCols[idx];
      if (col.editable !== false && !col.formula) return idx;
      idx += direction;
    }
    return -1; // no editable col found
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!selectedCell) return;

    const currentRowIndex = getRowIndex(selectedCell.rowId);
    const currentColIndex = getColIndex(selectedCell.colId);
    if (currentRowIndex < 0 || currentColIndex < 0) return;

    const moveTo = (rowIndex: number, colIndex: number) => {
      const rowId = getRowId(rowIndex);
      if (rowId && colIndex >= 0 && colIndex < visibleCols.length) {
        setSelectedCell({ rowId, colId: visibleCols[colIndex].id });
        scrollToIndex(rowIndex);
        e.preventDefault();
      }
    };

    if (isEditing) {
      // In editing mode
      if (e.key === 'Enter' && !e.shiftKey) {
        // Commit and move down
        setEditingCell(null);
        const nextRow = findNextDataRow(currentRowIndex, 1);
        if (nextRow !== currentRowIndex) moveTo(nextRow, currentColIndex);
        e.preventDefault();
      } else if (e.key === 'Escape') {
        setEditingCell(null);
        e.preventDefault();
      } else if (e.key === 'Tab') {
        setEditingCell(null);
        const direction = e.shiftKey ? -1 : 1;
        let nextCol = findNextEditableCol(currentColIndex, direction as 1 | -1);
        if (nextCol < 0) {
          // Wrap to next/prev row
          const nextRow = findNextDataRow(currentRowIndex, direction as 1 | -1);
          if (nextRow !== currentRowIndex) {
            nextCol = direction === 1
              ? editableCols.length > 0 ? visibleCols.findIndex(c => c.id === editableCols[0].id) : 0
              : editableCols.length > 0 ? visibleCols.findIndex(c => c.id === editableCols[editableCols.length - 1].id) : visibleCols.length - 1;
            moveTo(nextRow, nextCol);
          }
        } else {
          moveTo(currentRowIndex, nextCol);
        }
        e.preventDefault();
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
        if (currentColIndex < visibleCols.length - 1) moveTo(currentRowIndex, currentColIndex + 1);
        e.preventDefault();
        break;
      case 'Tab': {
        const direction = e.shiftKey ? -1 : 1;
        let nextCol = findNextEditableCol(currentColIndex, direction as 1 | -1);
        if (nextCol < 0) {
          const nextRow = findNextDataRow(currentRowIndex, direction as 1 | -1);
          if (nextRow !== currentRowIndex) {
            nextCol = direction === 1
              ? editableCols.length > 0 ? visibleCols.findIndex(c => c.id === editableCols[0].id) : 0
              : editableCols.length > 0 ? visibleCols.findIndex(c => c.id === editableCols[editableCols.length - 1].id) : visibleCols.length - 1;
            moveTo(nextRow, nextCol);
          }
        } else {
          moveTo(currentRowIndex, nextCol);
        }
        e.preventDefault();
        break;
      }
      case 'Enter': {
        const col = visibleCols[currentColIndex];
        if (col && col.editable !== false && !col.formula) {
          setEditingCell({ rowId: selectedCell.rowId, colId: selectedCell.colId });
          e.preventDefault();
        }
        break;
      }
      case 'Delete':
      case 'Backspace':
        // Clear cell value — handled by parent
        break;
    }
  }, [selectedCell, isEditing, flatRowCount, visibleCols, editableCols]);

  return { handleKeyDown };
}
