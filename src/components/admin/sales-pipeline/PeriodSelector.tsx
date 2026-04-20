// src/components/admin/sales-pipeline/PeriodSelector.tsx
// Period-väljare för tidsserie-grafer (3/6/12/24 mån)
import { Calendar } from 'lucide-react'

export type PeriodOption = 3 | 6 | 12 | 24

interface PeriodSelectorProps {
  value: PeriodOption
  onChange: (value: PeriodOption) => void
}

const OPTIONS: Array<{ value: PeriodOption; label: string }> = [
  { value: 3, label: '3m' },
  { value: 6, label: '6m' },
  { value: 12, label: '12m' },
  { value: 24, label: '24m' },
]

export default function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="inline-flex items-center gap-1 bg-slate-800/60 border border-slate-700 rounded-lg p-1">
      <Calendar className="w-3.5 h-3.5 text-slate-500 ml-2" />
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
            value === opt.value
              ? 'bg-[#20c58f] text-slate-900'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
