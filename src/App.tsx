import { useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import CollaborativeTable from './components/CollaborativeTable'
import type { DataColumnDef } from './components/CollaborativeTable/types'

const MOCK_USERS = [
  { id: '1', name: 'Alana', color: '#f87171' },
  { id: '2', name: 'Bob', color: '#60a5fa' },
  { id: '3', name: 'Charlie', color: '#34d399' },
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
      { label: '工程', value: '工程', color: '#e0f2fe' },
      { label: '产品', value: '产品', color: '#f3e8ff' },
      { label: '设计', value: '设计', color: '#fce7f3' },
      { label: '运营', value: '运营', color: '#ccfbf1' },
      { label: '市场', value: '市场', color: '#ffedd5' },
    ],
    groupable: true,
  },
  {
    id: 'status',
    header: '状态',
    type: 'enum',
    width: 130,
    enumOptions: [
      { label: 'TODO', value: 'TODO', color: '#f1f5f9' },
      { label: 'IN_PROGRESS', value: 'IN_PROGRESS', color: '#dbeafe' },
      { label: 'IN_REVIEW', value: 'IN_REVIEW', color: '#fef3c7' },
      { label: 'DONE', value: 'DONE', color: '#dcfce7' },
    ],
    groupable: true,
  },
  {
    id: 'priority',
    header: '优先级',
    type: 'enum',
    width: 110,
    enumOptions: [
      { label: 'LOW', value: 'LOW', color: '#f3f4f6' },
      { label: 'MEDIUM', value: 'MEDIUM', color: '#e0e7ff' },
      { label: 'HIGH', value: 'HIGH', color: '#ffedd5' },
      { label: 'CRITICAL', value: 'CRITICAL', color: '#fee2e2' },
    ],
    groupable: true,
  },
  {
    id: 'tag',
    header: '标签',
    type: 'enum',
    width: 90,
    enumOptions: [
      { label: 'P0', value: 'P0', color: '#fee2e2' },
      { label: 'P1', value: 'P1', color: '#ffedd5' },
      { label: 'P2', value: 'P2', color: '#fef3c7' },
      { label: 'Bug', value: 'Bug', color: '#ffe4e6' },
      { label: '需求', value: '需求', color: '#dbeafe' },
      { label: '优化', value: '优化', color: '#d1fae5' },
      { label: '技术债', value: '技术债', color: '#f3f4f6' },
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
      if (n <= 20) return '#fef2f2';
      if (n >= 80) return '#f0fdf4';
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
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">身份:</span>
          <select
            value={currentUser.id}
            onChange={(e) => setCurrentUser(MOCK_USERS.find(u => u.id === e.target.value) || MOCK_USERS[0])}
            className="border rounded-md px-3 py-1.5 text-sm bg-card outline-none focus:ring-2 focus:ring-ring"
          >
            {MOCK_USERS.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <div className="w-5 h-5 rounded-full border shadow-inner" style={{ backgroundColor: currentUser.color }} />
        </div>
      </header>

      <main className="flex-1 overflow-hidden p-4">
        <div className="bg-card rounded-xl shadow-lg h-full flex flex-col overflow-hidden border">
          <CollaborativeTable room={room} currentUser={currentUser} columns={DEMO_COLUMNS} />
        </div>
      </main>
    </div>
    </TooltipProvider>
  )
}
