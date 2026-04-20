// src/components/admin/sales-pipeline/PipelineTabs.tsx
// Tab-komponent för Allt/Offerter/Avtal i Försäljningspipeline
import { FileText, FileSignature, LayoutGrid } from 'lucide-react'

export type PipelineTabKey = 'all' | 'offer' | 'contract'

interface TabCount {
  all: number
  offer: number
  contract: number
}

interface PipelineTabsProps {
  active: PipelineTabKey
  onChange: (tab: PipelineTabKey) => void
  counts?: TabCount
}

const TABS: Array<{
  key: PipelineTabKey
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { key: 'all', label: 'Allt', icon: LayoutGrid },
  { key: 'offer', label: 'Offerter', icon: FileText },
  { key: 'contract', label: 'Avtal', icon: FileSignature },
]

export default function PipelineTabs({ active, onChange, counts }: PipelineTabsProps) {
  return (
    <div className="inline-flex items-center bg-slate-800/60 border border-slate-700 rounded-xl p-1 gap-1">
      {TABS.map(t => {
        const isActive = active === t.key
        const count = counts ? counts[t.key] : undefined
        const Icon = t.icon
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isActive
                ? 'bg-[#20c58f] text-slate-900 shadow-[0_0_18px_-6px_rgba(32,197,143,0.8)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{t.label}</span>
            {typeof count === 'number' && (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  isActive ? 'bg-slate-900/20 text-slate-900' : 'bg-slate-700/50 text-slate-300'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
