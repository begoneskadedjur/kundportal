import React, { useState } from 'react'
import { RefreshCw, BarChart3 } from 'lucide-react'
import { useEconomicsPeriod, type PeriodType } from '../../../contexts/EconomicsPeriodContext'
import Button from '../../ui/Button'

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '12m', label: '12M' },
  { value: 'ytd', label: 'YTD' },
]

const EconomicsHeader: React.FC = () => {
  const { periodType, setPeriodType } = useEconomicsPeriod()
  const [lastUpdated] = useState(new Date())

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-[#20c58f]/10">
          <BarChart3 className="w-6 h-6 text-[#20c58f]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Ekonomisk Översikt</h1>
          <p className="text-sm text-slate-400">Intäkter, lönsamhet och tillväxt i realtid</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Period selector */}
        <div className="flex bg-slate-800/60 border border-slate-700/50 rounded-lg p-1">
          {PERIOD_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setPeriodType(value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                periodType === value
                  ? 'bg-[#20c58f] text-white shadow-sm shadow-[#20c58f]/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <Button
          onClick={() => window.location.reload()}
          variant="secondary"
          className="flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-xs">
            {lastUpdated.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </Button>
      </div>
    </div>
  )
}

export default EconomicsHeader
