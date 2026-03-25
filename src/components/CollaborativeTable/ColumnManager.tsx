import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import type { DataColumnDef } from './types';

interface ColumnManagerProps {
  columns: DataColumnDef[];
  columnVisibility: Record<string, boolean>;
  onColumnVisibilityChange: (vis: Record<string, boolean>) => void;
  onAutoFitAll: () => void;
}

export function ColumnManager({ columns, columnVisibility, onColumnVisibilityChange, onAutoFitAll }: ColumnManagerProps) {
  const visibleCount = columns.filter(c => columnVisibility[c.id] !== false).length;

  const toggleColumn = (colId: string) => {
    const isVisible = columnVisibility[colId] !== false;
    // Prevent hiding the last visible column
    if (isVisible && visibleCount <= 1) return;
    onColumnVisibilityChange({ ...columnVisibility, [colId]: !isVisible });
  };

  return (
    <div className="flex items-center gap-1.5">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
            列管理
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-2" align="start" sideOffset={8}>
          <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">显示/隐藏列</div>
          <div className="space-y-0.5 max-h-[300px] overflow-y-auto">
            {columns.map(col => {
              const isVisible = columnVisibility[col.id] !== false;
              const isLastVisible = isVisible && visibleCount <= 1;
              return (
                <button
                  key={col.id}
                  className={`flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md transition-colors ${isLastVisible ? 'opacity-40 cursor-not-allowed' : 'hover:bg-accent cursor-pointer'}`}
                  onClick={() => toggleColumn(col.id)}
                  disabled={isLastVisible}
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isVisible ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                    {isVisible && (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                    )}
                  </span>
                  <span className="text-xs truncate">{col.header}</span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      <Button variant="outline" size="sm" className="gap-1.5" onClick={onAutoFitAll}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
        </svg>
        自动列宽
      </Button>
    </div>
  );
}
