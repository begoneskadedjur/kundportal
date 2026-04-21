import React from 'react'
import { Wallet, Percent, Clock } from 'lucide-react'
import SparklineKpiCard from './SparklineKpiCard'
import { useMrrSparkline, useAvgMarginSparkline, useOutstandingSparkline } from '../../../hooks/useEconomicsV2'
import { formatCurrency, formatPercentage } from '../../../utils/formatters'

const HeroMetrics: React.FC = () => {
  const mrr = useMrrSparkline()
  const margin = useAvgMarginSparkline()
  const outstanding = useOutstandingSparkline()

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <SparklineKpiCard
        label="MRR"
        value={mrr.data ? formatCurrency(mrr.data.current) : '–'}
        deltaPercent={mrr.data?.delta_percent ?? null}
        sparkline={mrr.data?.sparkline ?? []}
        icon={<Wallet className="w-3.5 h-3.5" />}
        loading={mrr.loading}
        subtitle="Aktiv återkommande intäkt"
      />
      <SparklineKpiCard
        label="Genomsnittlig marginal"
        value={margin.data ? formatPercentage(margin.data.current) : '–'}
        deltaPercent={margin.data?.delta_percent ?? null}
        sparkline={margin.data?.sparkline ?? []}
        icon={<Percent className="w-3.5 h-3.5" />}
        loading={margin.loading}
        subtitle="Senaste 12 månaderna"
      />
      <SparklineKpiCard
        label="Utestående"
        value={outstanding.data ? formatCurrency(outstanding.data.current) : '–'}
        deltaPercent={outstanding.data?.delta_percent ?? null}
        sparkline={outstanding.data?.sparkline ?? []}
        icon={<Clock className="w-3.5 h-3.5" />}
        loading={outstanding.loading}
        lowerIsBetter
        subtitle="Obetalda fakturor"
      />
    </div>
  )
}

export default HeroMetrics
