import React, { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { LineChart as LineIcon } from 'lucide-react'
import { useEconomicsPeriod } from '../../../contexts/EconomicsPeriodContext'
import { useTechnicianCommissionTrend } from '../../../hooks/useEconomicsV2'
import { formatCurrency, formatMonth, formatCompactNumber } from '../../../utils/formatters'
import SectionCard from './SectionCard'
import EmptyChartState from './EmptyChartState'
import type { CommissionStatus, CommissionStatusBreakdown } from '../../../services/economicsServiceV2'

const COLORS = [
  '#20c58f', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
]

const STATUS_META: Record<CommissionStatus, { label: string; dot: string }> = {
  pending_invoice:   { label: 'Väntar',   dot: 'bg-amber-400' },
  ready_for_payout:  { label: 'Redo',     dot: 'bg-[#20c58f]' },
  approved:          { label: 'Godkänd',  dot: 'bg-sky-400' },
  paid_out:          { label: 'Utbetald', dot: 'bg-slate-400' },
}
const STATUS_ORDER: CommissionStatus[] = ['pending_invoice', 'ready_for_payout', 'approved', 'paid_out']

type TooltipArgs = {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; color: string }>
  label?: string
  monthKey?: string
  breakdown?: CommissionStatusBreakdown
}

const CustomTooltip: React.FC<TooltipArgs> = ({ active, payload, label, monthKey, breakdown }) => {
  if (!active || !payload || payload.length === 0) return null
  const items = [...payload]
    .filter(p => (p.value || 0) > 0)
    .sort((a, b) => b.value - a.value)
  if (items.length === 0) return null

  const monthBreakdown = (monthKey && breakdown) ? breakdown[monthKey] : undefined

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl min-w-[260px] max-h-[340px] overflow-y-auto">
      <p className="text-xs font-semibold text-slate-200 mb-2">{label}</p>
      {items.map(p => {
        const techStatus = monthBreakdown?.[p.dataKey]
        return (
          <div key={p.dataKey} className="mb-2 last:mb-0 pb-2 last:pb-0 border-b last:border-b-0 border-slate-700/50">
            <div className="flex items-center justify-between gap-4 text-xs mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <span className="text-slate-200 font-medium truncate">{p.dataKey}</span>
              </div>
              <span className="text-slate-200 font-semibold shrink-0">{formatCurrency(Number(p.value || 0))}</span>
            </div>
            {techStatus && (
              <div className="pl-4 space-y-0.5">
                {STATUS_ORDER.map(s => {
                  const v = techStatus[s] || 0
                  if (v === 0) return null
                  return (
                    <div key={s} className="flex items-center justify-between gap-4 text-[10px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_META[s].dot}`} />
                        <span className="text-slate-400 truncate">{STATUS_META[s].label}</span>
                      </div>
                      <span className="text-slate-300 shrink-0">{formatCurrency(v)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const TechnicianCommissionTrend: React.FC = () => {
  const { monthsInPeriod } = useEconomicsPeriod()
  const { data, loading } = useTechnicianCommissionTrend(Math.max(monthsInPeriod, 6))
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const chartData = useMemo(() => {
    return (data?.data || []).map(p => ({
      ...p,
      month: formatMonth(p.month as string),
      _monthKey: p.month as string,
    }))
  }, [data])

  const technicians = data?.technicians || []
  const breakdown = data?.statusBreakdown
  const hasAny = chartData.some(p =>
    technicians.some(t => Number(p[t] || 0) > 0)
  )

  const toggle = (t: string) => {
    setHidden(prev => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  return (
    <SectionCard
      title="Provision per tekniker"
      subtitle="Månadsvis provision — klicka på tekniker för att toggla"
      icon={<LineIcon className="w-4 h-4" />}
      action={
        <div className="hidden md:flex items-center gap-2 flex-wrap">
          {STATUS_ORDER.map(s => (
            <div key={s} className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[s].dot}`} />
              <span className="text-[10px] text-slate-400">{STATUS_META[s].label}</span>
            </div>
          ))}
        </div>
      }
    >
      {loading ? (
        <div className="h-72 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#20c58f]" />
        </div>
      ) : !hasAny ? (
        <EmptyChartState height="h-72" />
      ) : (
        <div className="space-y-3">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => formatCompactNumber(v)} />
                <Tooltip
                  content={(props: any) => {
                    const item = chartData.find(c => c.month === props.label)
                    return (
                      <CustomTooltip
                        {...props}
                        monthKey={item?._monthKey}
                        breakdown={breakdown}
                      />
                    )
                  }}
                />
                {technicians.map((t, i) => (
                  <Line
                    key={t}
                    type="monotone"
                    dataKey={t}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    hide={hidden.has(t)}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap pt-1">
            {technicians.map((t, i) => {
              const isHidden = hidden.has(t)
              const color = COLORS[i % COLORS.length]
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggle(t)}
                  className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-opacity ${
                    isHidden ? 'opacity-40 hover:opacity-70' : 'opacity-100 hover:opacity-80'
                  }`}
                  title={isHidden ? 'Klicka för att visa' : 'Klicka för att dölja'}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className={isHidden ? 'text-slate-500 line-through' : 'text-slate-200'}>
                    {t}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </SectionCard>
  )
}

export default TechnicianCommissionTrend
