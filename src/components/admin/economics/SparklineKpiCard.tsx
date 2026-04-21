import React from 'react'
import { ResponsiveContainer, AreaChart, Area } from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { SparklinePoint } from '../../../services/economicsServiceV2'

interface SparklineKpiCardProps {
  label: string
  value: string
  deltaPercent: number | null
  sparkline: SparklinePoint[]
  icon?: React.ReactNode
  /** Lower is better (CAC, overdue). När true inverteras färgen på delta. */
  lowerIsBetter?: boolean
  loading?: boolean
  subtitle?: string
}

const SparklineKpiCard: React.FC<SparklineKpiCardProps> = ({
  label,
  value,
  deltaPercent,
  sparkline,
  icon,
  lowerIsBetter = false,
  loading = false,
  subtitle,
}) => {
  if (loading) {
    return (
      <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl h-[140px] animate-pulse">
        <div className="h-3 w-24 bg-slate-700/60 rounded mb-3" />
        <div className="h-7 w-32 bg-slate-700/60 rounded mb-4" />
        <div className="h-10 bg-slate-700/40 rounded" />
      </div>
    )
  }

  const hasDelta = deltaPercent !== null && Number.isFinite(deltaPercent)
  const positiveDelta = (deltaPercent ?? 0) >= 0
  const isGood = lowerIsBetter ? !positiveDelta : positiveDelta
  const deltaColor =
    !hasDelta || deltaPercent === 0
      ? 'text-slate-400'
      : isGood
      ? 'text-[#20c58f]'
      : 'text-red-400'

  const DeltaIcon =
    !hasDelta || deltaPercent === 0 ? Minus : positiveDelta ? TrendingUp : TrendingDown

  const sparkData = sparkline && sparkline.length > 0 ? sparkline : []
  const strokeColor = isGood ? '#20c58f' : '#ef4444'

  return (
    <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl flex flex-col justify-between h-[140px]">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {icon}
            <span className="uppercase tracking-wide">{label}</span>
          </div>
          {hasDelta && (
            <div className={`flex items-center gap-1 text-xs font-medium ${deltaColor}`}>
              <DeltaIcon className="w-3 h-3" />
              {deltaPercent! >= 0 ? '+' : ''}
              {deltaPercent!.toFixed(1)}%
            </div>
          )}
        </div>
        <div className="mt-1">
          <div className="text-2xl font-semibold text-white">{value}</div>
          {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
        </div>
      </div>
      <div className="h-10 -mx-1">
        {sparkData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
              <defs>
                <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={strokeColor}
                strokeWidth={1.5}
                fill={`url(#spark-${label})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-end">
            <div className="w-full h-[1px] bg-slate-700/60" />
          </div>
        )}
      </div>
    </div>
  )
}

export default SparklineKpiCard
