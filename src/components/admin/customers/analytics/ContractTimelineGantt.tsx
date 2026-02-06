// src/components/admin/customers/analytics/ContractTimelineGantt.tsx - Kontrakts-tidslinje (Gantt-stil)

import React, { useMemo, useState } from 'react'
import Card from '../../../ui/Card'
import { ConsolidatedCustomer } from '../../../../hooks/useConsolidatedCustomers'

interface ContractTimelineGanttProps {
  customers: ConsolidatedCustomer[]
  onCustomerClick?: (companyName: string) => void
}

type SortKey = 'endDate' | 'value' | 'health'

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

export default function ContractTimelineGantt({ customers, onCustomerClick }: ContractTimelineGanttProps) {
  const [sortBy, setSortBy] = useState<SortKey>('endDate')

  const now = new Date()

  // Tidsfönster: 3 mån bakåt + 18 mån framåt
  const timelineStart = useMemo(() => {
    const d = new Date(now)
    d.setMonth(d.getMonth() - 3)
    d.setDate(1)
    return d
  }, [])

  const timelineEnd = useMemo(() => {
    const d = new Date(now)
    d.setMonth(d.getMonth() + 18)
    d.setDate(1)
    return d
  }, [])

  const totalDays = (timelineEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)

  // Generera månadsmarkeringar
  const months = useMemo(() => {
    const result: { label: string; left: number; width: number }[] = []
    const current = new Date(timelineStart)
    while (current < timelineEnd) {
      const monthStart = new Date(current)
      const monthEnd = new Date(current)
      monthEnd.setMonth(monthEnd.getMonth() + 1)

      const left = ((monthStart.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)) / totalDays * 100
      const width = ((Math.min(monthEnd.getTime(), timelineEnd.getTime()) - monthStart.getTime()) / (1000 * 60 * 60 * 24)) / totalDays * 100

      result.push({
        label: monthStart.toLocaleDateString('sv-SE', { month: 'short', year: monthStart.getMonth() === 0 ? 'numeric' : undefined }),
        left,
        width,
      })
      current.setMonth(current.getMonth() + 1)
    }
    return result
  }, [timelineStart, timelineEnd, totalDays])

  // Idag-markör position
  const todayPosition = ((now.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)) / totalDays * 100

  // Filtrera och sortera kunder
  const bars = useMemo(() => {
    const filtered = customers
      .filter(c => c.nextRenewalDate)
      .map(c => {
        const endDate = new Date(c.nextRenewalDate!)
        const startDate = c.earliestContractStartDate
          ? new Date(c.earliestContractStartDate)
          : new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000) // Antag 1 år om start saknas

        const diffMs = endDate.getTime() - now.getTime()
        const monthsRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44))

        // Klipp bar till tidsfönstret
        const barStart = Math.max(startDate.getTime(), timelineStart.getTime())
        const barEnd = Math.min(endDate.getTime(), timelineEnd.getTime())

        const leftPct = ((barStart - timelineStart.getTime()) / (1000 * 60 * 60 * 24)) / totalDays * 100
        const widthPct = ((barEnd - barStart) / (1000 * 60 * 60 * 24)) / totalDays * 100

        // Färg baserad på tid kvar
        let color = 'bg-green-500'
        if (diffMs < 0) color = 'bg-slate-500'
        else if (monthsRemaining <= 3) color = 'bg-red-500'
        else if (monthsRemaining <= 6) color = 'bg-amber-500'

        return {
          name: c.company_name,
          value: c.totalContractValue,
          healthScore: c.overallHealthScore.score,
          endDate,
          monthsRemaining: Math.max(0, monthsRemaining),
          expired: diffMs < 0,
          leftPct: Math.max(0, leftPct),
          widthPct: Math.max(0.5, widthPct), // Min bredd 0.5% för synlighet
          color,
        }
      })
      .filter(b => b.widthPct > 0)

    // Sortera
    switch (sortBy) {
      case 'value':
        return filtered.sort((a, b) => b.value - a.value)
      case 'health':
        return filtered.sort((a, b) => a.healthScore - b.healthScore)
      default:
        return filtered.sort((a, b) => a.endDate.getTime() - b.endDate.getTime())
    }
  }, [customers, sortBy, timelineStart, timelineEnd, totalDays, now])

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Kontrakts-tidslinje</h3>
          <p className="text-xs text-slate-400 mt-1">{bars.length} kontrakt med definierad löptid</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Sortera:</span>
          {(['endDate', 'value', 'health'] as SortKey[]).map(key => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                sortBy === key
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white hover:border-slate-500'
              }`}
            >
              {key === 'endDate' ? 'Slutdatum' : key === 'value' ? 'Värde' : 'Health'}
            </button>
          ))}
        </div>
      </div>

      {bars.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
          Inga kontrakt med definierade datum
        </div>
      ) : (
        <div className="relative">
          {/* Månads-header */}
          <div className="relative h-6 mb-1 border-b border-slate-700">
            {months.map((month, i) => (
              <div
                key={i}
                className="absolute top-0 h-full text-xs text-slate-500 border-l border-slate-700/50 pl-1"
                style={{ left: `${month.left}%`, width: `${month.width}%` }}
              >
                {month.label}
              </div>
            ))}
          </div>

          {/* Bars */}
          <div className="max-h-[500px] overflow-y-auto space-y-0.5">
            {bars.map((bar, i) => (
              <div
                key={i}
                className="group flex items-center h-7 hover:bg-slate-800/30 rounded transition-colors cursor-pointer"
                onClick={() => onCustomerClick?.(bar.name)}
                title={`${bar.name} — ${formatCurrency(bar.value)} — ${bar.expired ? 'Utgånget' : `${bar.monthsRemaining} mån kvar`}`}
              >
                {/* Kundnamn */}
                <div className="w-36 flex-shrink-0 pr-2 text-right">
                  <span className="text-xs text-slate-400 group-hover:text-white truncate block transition-colors">
                    {bar.name}
                  </span>
                </div>

                {/* Tidslinje-area */}
                <div className="flex-1 relative h-full">
                  {/* Idag-linje */}
                  <div
                    className="absolute top-0 h-full w-px bg-red-500/40 z-10"
                    style={{ left: `${todayPosition}%` }}
                  />
                  {/* Bar */}
                  <div
                    className={`absolute top-1 h-5 rounded-sm ${bar.color} opacity-80 group-hover:opacity-100 transition-opacity`}
                    style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%`, minWidth: '4px' }}
                  />
                </div>

                {/* Värde & tid kvar */}
                <div className="w-24 flex-shrink-0 pl-2 text-right">
                  <span className="text-xs text-slate-500 group-hover:text-slate-300">
                    {formatCurrency(bar.value)}
                  </span>
                </div>
                <div className="w-16 flex-shrink-0 pl-2 text-right">
                  <span className={`text-xs font-medium ${
                    bar.expired ? 'text-slate-500' :
                    bar.monthsRemaining <= 3 ? 'text-red-400' :
                    bar.monthsRemaining <= 6 ? 'text-amber-400' :
                    'text-green-400'
                  }`}>
                    {bar.expired ? 'Utgånget' : `${bar.monthsRemaining} mån`}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-700">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-2 rounded-sm bg-green-500" />
              <span className="text-xs text-slate-400">&gt; 6 mån</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-2 rounded-sm bg-amber-500" />
              <span className="text-xs text-slate-400">3-6 mån</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-2 rounded-sm bg-red-500" />
              <span className="text-xs text-slate-400">&lt; 3 mån</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-2 rounded-sm bg-slate-500" />
              <span className="text-xs text-slate-400">Utgånget</span>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <div className="w-px h-3 bg-red-500/60" />
              <span className="text-xs text-red-400/60">Idag</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
