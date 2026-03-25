import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { DataColumnDef } from './types';

interface GroupToolbarProps {
  columns: DataColumnDef[];
  grouping: string[];
  onGroupingChange: (grouping: string[]) => void;
}

export function GroupToolbar({ columns, grouping, onGroupingChange }: GroupToolbarProps) {
  const groupableColumns = columns.filter(c => c.groupable !== false && !c.formula);

  const setGroup = (level: number, fieldId: string) => {
    if (fieldId === '__none__') {
      onGroupingChange(grouping.slice(0, level));
    } else {
      const next = [...grouping];
      next[level] = fieldId;
      onGroupingChange(next.slice(0, level + 1));
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">分组:</span>
      <Select value={grouping[0] || '__none__'} onValueChange={v => setGroup(0, v)}>
        <SelectTrigger size="sm" className="w-[100px]"><SelectValue placeholder="无" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">无</SelectItem>
          {groupableColumns.map(c => <SelectItem key={c.id} value={c.id}>{c.header}</SelectItem>)}
        </SelectContent>
      </Select>

      {grouping.length > 0 && grouping[0] && (
        <>
          <span className="text-muted-foreground text-xs">→</span>
          <Select value={grouping[1] || '__none__'} onValueChange={v => setGroup(1, v)}>
            <SelectTrigger size="sm" className="w-[100px]"><SelectValue placeholder="无" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">无</SelectItem>
              {groupableColumns.filter(c => c.id !== grouping[0]).map(c => <SelectItem key={c.id} value={c.id}>{c.header}</SelectItem>)}
            </SelectContent>
          </Select>
        </>
      )}

      {grouping.length > 1 && grouping[1] && (
        <>
          <span className="text-muted-foreground text-xs">→</span>
          <Select value={grouping[2] || '__none__'} onValueChange={v => setGroup(2, v)}>
            <SelectTrigger size="sm" className="w-[100px]"><SelectValue placeholder="无" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">无</SelectItem>
              {groupableColumns.filter(c => c.id !== grouping[0] && c.id !== grouping[1]).map(c => <SelectItem key={c.id} value={c.id}>{c.header}</SelectItem>)}
            </SelectContent>
          </Select>
        </>
      )}

      {grouping.length > 0 && (
        <Button variant="ghost" size="sm" onClick={() => onGroupingChange([])} className="text-xs text-muted-foreground h-7 px-2">
          清除
        </Button>
      )}
    </div>
  );
}
