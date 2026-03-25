import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { DataColumnDef, ConditionalRule, ConditionOperator } from './types';

const COLORS = [
  { label: '红', value: '#fee2e2' },
  { label: '橙', value: '#ffedd5' },
  { label: '黄', value: '#fef3c7' },
  { label: '绿', value: '#dcfce7' },
  { label: '蓝', value: '#dbeafe' },
  { label: '紫', value: '#f3e8ff' },
  { label: '粉', value: '#fce7f3' },
  { label: '灰', value: '#f1f5f9' },
];

const OPERATORS_BY_TYPE: Record<string, { value: ConditionOperator; label: string }[]> = {
  number: [
    { value: 'gt', label: '大于' }, { value: 'lt', label: '小于' },
    { value: 'eq', label: '等于' }, { value: 'between', label: '范围内' },
    { value: 'empty', label: '为空' },
  ],
  string: [
    { value: 'contains', label: '包含' }, { value: 'not_contains', label: '不包含' },
    { value: 'str_eq', label: '等于' }, { value: 'empty', label: '为空' },
  ],
  enum: [
    { value: 'enum_eq', label: '等于' }, { value: 'enum_neq', label: '不等于' },
    { value: 'empty', label: '为空' },
  ],
  date: [
    { value: 'before', label: '早于' }, { value: 'after', label: '晚于' },
    { value: 'date_between', label: '范围内' }, { value: 'empty', label: '为空' },
  ],
};

interface ConditionalFormatPanelProps {
  columns: DataColumnDef[];
  rules: ConditionalRule[];
  onRulesChange: (rules: ConditionalRule[]) => void;
}

export function ConditionalFormatPanel({ columns, rules, onRulesChange }: ConditionalFormatPanelProps) {
  const [open, setOpen] = useState(false);
  const formattableColumns = columns.filter(c => !c.formula);

  const addRule = () => {
    const col = formattableColumns[0];
    if (!col) return;
    const ops = OPERATORS_BY_TYPE[col.type] || OPERATORS_BY_TYPE.string;
    onRulesChange([...rules, {
      id: uuidv4(),
      columnId: col.id,
      operator: ops[0].value,
      value: '',
      style: { backgroundColor: COLORS[0].value },
    }]);
  };

  const updateRule = (id: string, patch: Partial<ConditionalRule>) => {
    onRulesChange(rules.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, ...patch };
      // Reset operator/value when column changes
      if (patch.columnId && patch.columnId !== r.columnId) {
        const col = columns.find(c => c.id === patch.columnId);
        const ops = OPERATORS_BY_TYPE[col?.type || 'string'] || OPERATORS_BY_TYPE.string;
        updated.operator = ops[0].value;
        updated.value = '';
      }
      return updated;
    }));
  };

  const removeRule = (id: string) => onRulesChange(rules.filter(r => r.id !== id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={rules.length > 0 ? 'secondary' : 'outline'} size="sm" className="gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          条件格式
          {rules.length > 0 && (
            <span className="bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{rules.length}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-4" align="start" sideOffset={8}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold">条件格式规则</span>
          <button onClick={() => { onRulesChange([]); }} className="text-xs text-muted-foreground hover:text-destructive transition-colors">清除全部</button>
        </div>

        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {rules.map(rule => {
            const col = columns.find(c => c.id === rule.columnId);
            const colType = col?.type || 'string';
            const ops = OPERATORS_BY_TYPE[colType] || OPERATORS_BY_TYPE.string;
            const needsValue = rule.operator !== 'empty';
            const isBetween = rule.operator === 'between' || rule.operator === 'date_between';

            return (
              <div key={rule.id} className="flex items-center gap-1.5 p-1.5 rounded-md bg-muted/50">
                {/* Column select */}
                <Select value={rule.columnId} onValueChange={v => updateRule(rule.id, { columnId: v })}>
                  <SelectTrigger className="w-[90px] h-7" size="sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {formattableColumns.map(c => <SelectItem key={c.id} value={c.id}>{c.header}</SelectItem>)}
                  </SelectContent>
                </Select>

                {/* Operator select */}
                <Select value={rule.operator} onValueChange={v => updateRule(rule.id, { operator: v as ConditionOperator, value: '' })}>
                  <SelectTrigger className="w-[80px] h-7" size="sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ops.map(op => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                  </SelectContent>
                </Select>

                {/* Value input */}
                {needsValue && !isBetween && (
                  colType === 'enum' && col?.enumOptions ? (
                    <Select value={String(rule.value || '')} onValueChange={v => updateRule(rule.id, { value: v })}>
                      <SelectTrigger className="w-[80px] h-7" size="sm"><SelectValue placeholder="值" /></SelectTrigger>
                      <SelectContent>
                        {col.enumOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <input
                      type={colType === 'number' ? 'number' : colType === 'date' ? 'date' : 'text'}
                      className="w-[70px] h-7 rounded-md border border-input bg-transparent px-1.5 text-xs outline-none"
                      value={String(rule.value || '')}
                      onChange={e => updateRule(rule.id, { value: colType === 'number' ? Number(e.target.value) : e.target.value })}
                      placeholder="值"
                    />
                  )
                )}

                {needsValue && isBetween && (
                  <div className="flex items-center gap-1">
                    <input
                      type={colType === 'date' ? 'date' : 'number'}
                      className="w-[60px] h-7 rounded-md border border-input bg-transparent px-1 text-xs outline-none"
                      value={Array.isArray(rule.value) ? String(rule.value[0] ?? '') : ''}
                      onChange={e => updateRule(rule.id, { value: [colType === 'number' ? Number(e.target.value) : e.target.value, Array.isArray(rule.value) ? rule.value[1] : ''] as any })}
                    />
                    <span className="text-[10px] text-muted-foreground">~</span>
                    <input
                      type={colType === 'date' ? 'date' : 'number'}
                      className="w-[60px] h-7 rounded-md border border-input bg-transparent px-1 text-xs outline-none"
                      value={Array.isArray(rule.value) ? String(rule.value[1] ?? '') : ''}
                      onChange={e => updateRule(rule.id, { value: [Array.isArray(rule.value) ? rule.value[0] : '', colType === 'number' ? Number(e.target.value) : e.target.value] as any })}
                    />
                  </div>
                )}

                {/* Color picker */}
                <div className="flex items-center gap-0.5 shrink-0">
                  {COLORS.map(c => (
                    <button
                      key={c.value}
                      className={`w-4 h-4 rounded-full border-2 transition-transform ${rule.style.backgroundColor === c.value ? 'border-primary scale-125' : 'border-transparent hover:scale-110'}`}
                      style={{ backgroundColor: c.value }}
                      onClick={() => updateRule(rule.id, { style: { ...rule.style, backgroundColor: c.value } })}
                      title={c.label}
                    />
                  ))}
                </div>

                {/* Delete */}
                <button onClick={() => removeRule(rule.id)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0 ml-auto">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            );
          })}
        </div>

        <Button variant="ghost" size="sm" onClick={addRule} className="mt-3 gap-1 text-primary">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
          添加规则
        </Button>
      </PopoverContent>
    </Popover>
  );
}

// Compile rules into evaluation functions
export function compileConditionalRules(rules: ConditionalRule[]): (colId: string, value: any) => string | null {
  if (rules.length === 0) return () => null;

  return (colId: string, value: any): string | null => {
    for (const rule of rules) {
      if (rule.columnId !== colId) continue;
      if (evaluateRule(rule, value)) {
        return rule.style.backgroundColor;
      }
    }
    return null;
  };
}

function evaluateRule(rule: ConditionalRule, value: any): boolean {
  const { operator } = rule;

  if (operator === 'empty') return value == null || value === '';

  const rv = rule.value;

  switch (operator) {
    case 'gt': return Number(value) > Number(rv);
    case 'lt': return Number(value) < Number(rv);
    case 'eq': return Number(value) === Number(rv);
    case 'between': {
      const [min, max] = Array.isArray(rv) ? rv : [0, 0];
      const n = Number(value);
      return n >= Number(min) && n <= Number(max);
    }
    case 'contains': return String(value || '').toLowerCase().includes(String(rv || '').toLowerCase());
    case 'not_contains': return !String(value || '').toLowerCase().includes(String(rv || '').toLowerCase());
    case 'str_eq': return String(value || '') === String(rv || '');
    case 'enum_eq': return String(value) === String(rv);
    case 'enum_neq': return String(value) !== String(rv);
    case 'before': return String(value || '') < String(rv || '');
    case 'after': return String(value || '') > String(rv || '');
    case 'date_between': {
      const [from, to] = Array.isArray(rv) ? rv : ['', ''];
      const d = String(value || '');
      return (!from || d >= String(from)) && (!to || d <= String(to));
    }
    default: return false;
  }
}
