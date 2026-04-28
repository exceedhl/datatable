import { useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import CollaborativeTable from './components/CollaborativeTable'
import type { DataColumnDef } from './components/CollaborativeTable/types'

const MOCK_USERS = [
  { id: '1', name: 'Alana', color: 'oklch(var(--chart-1))' },
  { id: '2', name: 'Bob', color: 'oklch(var(--chart-2))' },
  { id: '3', name: 'Charlie', color: 'oklch(var(--chart-3))' },
]

const DEMO_COLUMNS: DataColumnDef[] = [
  {
    id: 'owner',
    header: '负责人',
    type: 'string',
    groupable: true,
    width: 120,
  },
  {
    id: 'title',
    header: '任务标题',
    type: 'string',
    groupable: false,
    width: 220,
  },
  {
    id: 'department',
    header: '部门',
    type: 'enum',
    width: 100,
    enumOptions: [
      { label: '工程', value: '工程', color: 'var(--chart-1)' },
      { label: '产品', value: '产品', color: 'var(--chart-2)' },
      { label: '设计', value: '设计', color: 'var(--chart-3)' },
      { label: '运营', value: '运营', color: 'var(--chart-4)' },
      { label: '市场', value: '市场', color: 'var(--chart-5)' },
    ],
    groupable: true,
  },
  {
    id: 'status',
    header: '状态',
    type: 'enum',
    width: 130,
    enumOptions: [
      { label: 'TODO', value: 'TODO', color: 'var(--muted-foreground)' },
      { label: 'IN_PROGRESS', value: 'IN_PROGRESS', color: 'var(--info)' },
      { label: 'IN_REVIEW', value: 'IN_REVIEW', color: 'var(--warning)' },
      { label: 'DONE', value: 'DONE', color: 'var(--success)' },
    ],
    groupable: true,
  },
  {
    id: 'priority',
    header: '优先级',
    type: 'enum',
    width: 110,
    enumOptions: [
      { label: 'LOW', value: 'LOW', color: 'var(--muted-foreground)' },
      { label: 'MEDIUM', value: 'MEDIUM', color: 'var(--info)' },
      { label: 'HIGH', value: 'HIGH', color: 'var(--warning)' },
      { label: 'CRITICAL', value: 'CRITICAL', color: 'var(--destructive)' },
    ],
    groupable: true,
  },
  {
    id: 'tag',
    header: '标签',
    type: 'enum',
    width: 90,
    enumOptions: [
      { label: 'P0', value: 'P0', color: 'var(--destructive)' },
      { label: 'P1', value: 'P1', color: 'var(--warning)' },
      { label: 'P2', value: 'P2', color: 'var(--info)' },
      { label: 'Bug', value: 'Bug', color: 'var(--destructive)' },
      { label: '需求', value: '需求', color: 'var(--chart-1)' },
      { label: '优化', value: '优化', color: 'var(--success)' },
      { label: '技术债', value: '技术债', color: 'var(--muted-foreground)' },
    ],
    groupable: true,
  },
  {
    id: 'progress',
    header: '进度',
    type: 'number',
    width: 80,
    numberRange: { min: 0, max: 100, step: 1 },
    numberFormat: { decimals: 0, suffix: '%' },
    highlight: (val) => {
      const n = Number(val);
      if (n <= 20) return 'var(--destructive)';
      if (n >= 80) return 'var(--success)';
      return null;
    },
  },
  {
    id: 'estimate',
    header: '预估(h)',
    type: 'number',
    width: 100,
    numberRange: { min: 1, max: 200, step: 1 },
    numberFormat: { decimals: 1, thousandSeparator: true },
  },
  {
    id: 'createdAt',
    header: '创建日期',
    type: 'date',
    width: 120,
    groupable: false,
  },
  {
    id: '_cost',
    header: '预估成本',
    type: 'number',
    width: 110,
    editable: false,
    sortable: true,
    groupable: false,
    filterable: false,
    formula: (row) => {
      const estimate = Number(row.estimate) || 0;
      return Math.round(estimate * 150);
    },
    formulaExpression: '预估(h) × 150',
    numberFormat: { currency: 'CNY', decimals: 0 },
  },
  {
    id: '_score',
    header: '综合分',
    type: 'number',
    width: 90,
    editable: false,
    sortable: true,
    groupable: false,
    filterable: false,
    formula: (row) => {
      const priorityWeight: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
      const w = priorityWeight[row.priority] || 1;
      return Math.round((row.progress || 0) * w / 4);
    },
    formulaExpression: '进度 × 优先级权重 / 4',
  },
]

export default function App() {
  const [currentUser, setCurrentUser] = useState(MOCK_USERS[0])
  const [room] = useState('demo-room-alpha')

  return (
    <TooltipProvider>
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <header className="h-14 bg-card border-b px-6 flex items-center justify-between shrink-0 shadow-sm">
        <h1 className="text-lg font-bold">Collaborative DataTable Demo</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mr-1">Identity</span>
          <select
            value={currentUser.id}
            onChange={(e) => setCurrentUser(MOCK_USERS.find(u => u.id === e.target.value) || MOCK_USERS[0])}
            className="border-0 rounded px-2 py-1 h-7 text-xs font-medium bg-muted/50 hover:bg-muted outline-none focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
          >
            {MOCK_USERS.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <div className="w-4 h-4 rounded-full border border-border/50 shadow-inner ml-1" style={{ backgroundColor: currentUser.color }} />
        </div>
      </header>

      <main className="flex-1 overflow-hidden p-4">
        <div className="bg-card rounded-lg h-full flex flex-col overflow-hidden border">
          <CollaborativeTable room={room} currentUser={currentUser} columns={DEMO_COLUMNS} />
        </div>
      </main>
    </div>
    </TooltipProvider>
  )
}
