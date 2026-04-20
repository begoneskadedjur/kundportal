// src/components/admin/sales-pipeline/DeepDiveTabs.tsx
// Tabb-skal som håller de 3 djupdykningsvyerna under huvudgrid.
import { useState } from 'react'
import { Package, ShoppingCart, Wrench } from 'lucide-react'

export type DeepDiveTabKey = 'services' | 'articles' | 'technicians'

interface DeepDiveTabsProps {
  services: React.ReactNode
  articles: React.ReactNode
  technicians: React.ReactNode
  counts?: {
    services?: number
    articles?: number
    technicians?: number
  }
  defaultTab?: DeepDiveTabKey
}

const TABS: Array<{
  key: DeepDiveTabKey
  label: string
  icon: typeof Package
  color: string
}> = [
  { key: 'services', label: 'Tjänster', icon: Package, color: 'text-[#20c58f]' },
  { key: 'articles', label: 'Inköp / artiklar', icon: ShoppingCart, color: 'text-amber-400' },
  { key: 'technicians', label: 'Tekniker', icon: Wrench, color: 'text-purple-400' },
]

export default function DeepDiveTabs({
  services,
  articles,
  technicians,
  counts,
  defaultTab = 'services',
}: DeepDiveTabsProps) {
  const [active, setActive] = useState<DeepDiveTabKey>(defaultTab)

  const content = active === 'services' ? services : active === 'articles' ? articles : technicians

  return (
    <div className="bg-slate-800/20 border border-slate-700/40 rounded-2xl p-3">
      <div className="flex items-center gap-1 mb-3 border-b border-slate-700/50 pb-2">
        {TABS.map(t => {
          const Icon = t.icon
          const isActive = active === t.key
          const count = counts?.[t.key]
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[#20c58f] text-slate-900'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-900' : t.color}`} />
              <span>{t.label}</span>
              {typeof count === 'number' && count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${
                    isActive ? 'bg-slate-900/20 text-slate-900' : 'bg-slate-800/60 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div>{content}</div>
    </div>
  )
}
