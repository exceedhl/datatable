import { ReactNode } from 'react';

export type ColumnType = 'string' | 'number' | 'enum' | 'date';

export interface EnumOption {
  label: string;
  value: string;
  color?: string;
}

export interface NumberFormatConfig {
  decimals?: number;
  thousandSeparator?: boolean;
  currency?: 'CNY' | 'USD' | 'EUR' | 'GBP' | 'JPY';
  suffix?: string;
}

export interface DataColumnDef {
  id: string;
  header: string;
  type: ColumnType;
  width?: number | string;
  editable?: boolean;
  sortable?: boolean;
  groupable?: boolean;
  filterable?: boolean;
  enumOptions?: EnumOption[];
  numberRange?: { min?: number; max?: number; step?: number };
  dateFormat?: string;
  cellEditor?: (ctx: EditorContext) => ReactNode;
  // Conditional highlighting (prop-based, legacy)
  highlight?: (value: any, row: Record<string, any>) => string | null;
  // Number formatting (DT-C13)
  numberFormat?: NumberFormatConfig;
  // Formula column
  formula?: (row: Record<string, any>) => any;
  // Formula expression string for tooltip display (DT-C14)
  formulaExpression?: string;
}

export interface EditorContext {
  rowData: Record<string, any>;
  columnDef: DataColumnDef;
  value: any;
  onCommit: (val: any) => void;
  onCancel: () => void;
}

export interface FilterCondition {
  fieldId: string;
  type: ColumnType;
  operator: string;
  value: any;
}

// DT-C10: Conditional formatting rule
export type ConditionOperator =
  | 'gt' | 'lt' | 'eq' | 'between' | 'empty'
  | 'contains' | 'not_contains' | 'str_eq'
  | 'enum_eq' | 'enum_neq'
  | 'before' | 'after' | 'date_between';

export interface ConditionalRule {
  id: string;
  columnId: string;
  operator: ConditionOperator;
  value: string | number | [number, number] | [string, string];
  style: {
    backgroundColor: string;
    textColor?: string;
  };
}

// DT-C11: Persisted view config
export interface PersistedViewConfig {
  version: number;
  filters: FilterCondition[];
  groupBy: string[];
  columnOrder: string[];
  columnSizing: Record<string, number>;
  columnVisibility: Record<string, boolean>;
  frozenColumnCount: number;
  conditionalRules: ConditionalRule[];
}

// DT-C9: Column view state
export interface ColumnViewState {
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;
  columnSizing: Record<string, number>;
  frozenColumnCount: number;
}
