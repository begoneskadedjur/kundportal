import React, { useState } from 'react'
import { BarChart3 } from 'lucide-react'
import MonthlyRevenueChart from './MonthlyRevenueChart'
import BeGoneMonthlyStatsChart from './BeGoneMonthlyStatsChart'

type Tab = 'samlad' | 'avtal' | 'engangsjobb'

const TABS: { value: Tab; label: string }[] = [
  { value: 'samlad', label: 'Samlad Översikt' },
  { value: 'avtal', label: 'Avtalskunder' },
  { value: 'engangsjobb', label: 'Engångsjobb' },
]

const UnifiedRevenueAnalysis: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('samlad')

  return (
    <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-[#20c58f]" />
          Intäktsanalys
        </h3>

        {/* Tab selector */}
        <div className="flex bg-slate-900/50 border border-slate-700/50 rounded-lg p-0.5">
          {TABS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                activeTab === value
                  ? 'bg-[#20c58f] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        {activeTab === 'samlad' && <MonthlyRevenueChart />}
        {activeTab === 'avtal' && <MonthlyRevenueChart />}
        {activeTab === 'engangsjobb' && <BeGoneMonthlyStatsChart />}
      </div>
    </div>
  )
}

export default UnifiedRevenueAnalysis
