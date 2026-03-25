import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { DataColumnDef, FilterCondition } from './types';

interface FilterPanelProps {
  columns: DataColumnDef[];
  filters: FilterCondition[];
  onFiltersChange: (filters: FilterCondition[]) => void;
}

export function FilterPanel({ columns, filters, onFiltersChange }: FilterPanelProps) {
  const filterableColumns = columns.filter(c => c.filterable !== false && !c.formula);
  const [open, setOpen] = useState(false);

  const addFilter = () => {
    const col = filterableColumns[0];
    if (!col) return;
    onFiltersChange([...filters, {
      fieldId: col.id, type: col.type,
      operator: col.type === 'number' ? 'range' : col.type === 'enum' ? 'in' : 'contains',
      value: col.type === 'enum' ? [] : '',
    }]);
  };

  const removeFilter = (i: number) => onFiltersChange(filters.filter((_, idx) => idx !== i));

  const updateFilter = (i: number, patch: Partial<FilterCondition>) => {
    const next = [...filters];
    next[i] = { ...next[i], ...patch };
    if (patch.fieldId) {
      const col = columns.find(c => c.id === patch.fieldId);
      next[i].type = col?.type || 'string';
      next[i].operator = (col?.type === 'number' || col?.type === 'date') ? 'range' : col?.type === 'enum' ? 'in' : 'contains';
      next[i].value = col?.type === 'enum' ? [] : '';
    }
    onFiltersChange(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={filters.length > 0 ? 'secondary' : 'outline'} size="sm" className="gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
          筛选
          {filters.length > 0 && (
            <span className="bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{filters.length}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[480px] p-4" align="start" sideOffset={8}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold">筛选条件</span>
          <button onClick={() => { onFiltersChange([]); setOpen(false); }} className="text-xs text-muted-foreground hover:text-destructive transition-colors">清除全部</button>
        </div>

        <div className="space-y-2">
          {filters.map((f, i) => {
            const col = columns.find(c => c.id === f.fieldId);
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-medium w-8 shrink-0 text-center">{i === 0 ? 'WHERE' : 'AND'}</span>
                <Select value={f.fieldId} onValueChange={v => updateFilter(i, { fieldId: v })}>
                  <SelectTrigger className="w-[120px]" size="sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {filterableColumns.map(c => <SelectItem key={c.id} value={c.id}>{c.header}</SelectItem>)}
                  </SelectContent>
                </Select>

                {f.type === 'string' && (
                  <input className="flex-1 h-7 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus:ring-1 focus:ring-ring" placeholder="包含..." value={f.value || ''} onChange={e => updateFilter(i, { value: e.target.value })} />
                )}
                {f.type === 'number' && (
                  <div className="flex items-center gap-1 flex-1">
                    <input type="number" className="w-20 h-7 rounded-md border border-input bg-transparent px-2 text-sm outline-none" placeholder="≥" value={f.value?.[0] ?? ''} onChange={e => updateFilter(i, { value: [e.target.value, f.value?.[1] ?? ''] })} />
                    <span className="text-muted-foreground text-xs">~</span>
                    <input type="number" className="w-20 h-7 rounded-md border border-input bg-transparent px-2 text-sm outline-none" placeholder="≤" value={f.value?.[1] ?? ''} onChange={e => updateFilter(i, { value: [f.value?.[0] ?? '', e.target.value] })} />
                  </div>
                )}
                {f.type === 'date' && (
                  <div className="flex items-center gap-1 flex-1">
                    <input type="date" className="h-7 rounded-md border border-input bg-transparent px-2 text-sm outline-none" value={f.value?.[0] ?? ''} onChange={e => updateFilter(i, { value: [e.target.value, f.value?.[1] ?? ''] })} />
                    <span className="text-muted-foreground text-xs">~</span>
                    <input type="date" className="h-7 rounded-md border border-input bg-transparent px-2 text-sm outline-none" value={f.value?.[1] ?? ''} onChange={e => updateFilter(i, { value: [f.value?.[0] ?? '', e.target.value] })} />
                  </div>
                )}
                {f.type === 'enum' && col?.enumOptions && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="flex-1 justify-between h-7 text-xs font-normal">
                        {(f.value || []).length > 0
                          ? `已选 ${(f.value || []).length} 项`
                          : '选择值...'}
                        <svg className="w-3 h-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[180px] p-1" align="start">
                      {col.enumOptions.map(opt => {
                        const sel = (f.value || []).includes(opt.value);
                        return (
                          <button key={opt.value}
                            className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors"
                            onClick={() => updateFilter(i, { value: sel ? (f.value || []).filter((v: string) => v !== opt.value) : [...(f.value || []), opt.value] })}
                          >
                            <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${sel ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                              {sel && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                            </span>
                            {opt.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />}
                            {opt.label}
                          </button>
                        );
                      })}
                    </PopoverContent>
                  </Popover>
                )}

                <button onClick={() => removeFilter(i)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            );
          })}
        </div>

        <Button variant="ghost" size="sm" onClick={addFilter} className="mt-3 gap-1 text-primary">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
          添加条件
        </Button>
      </PopoverContent>
    </Popover>
  );
}
