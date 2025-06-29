// 📁 src/components/admin/economics/KpiCards.tsx
import React from 'react'
import { TrendingUp, DollarSign, Users, AlertTriangle, Target, BarChart3 } from 'lucide-react'
import Card from '../../ui/Card'
import { useKpiData } from '../../../hooks/useEconomicsDashboard'

interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
  icon: React.ReactNode
  trend?: {
    value: number
    isPositive: boolean
  }
  color: 'green' | 'blue' | 'purple' | 'yellow' | 'red' | 'indigo'
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, subtitle, icon, trend, color }) => {
  const colorClasses = {
    green: 'from-green-500/10 to-emerald-500/10 border-green-500/20 text-green-400',
    blue: 'from-blue-500/10 to-cyan-500/10 border-blue-500/20 text-blue-400',
    purple: 'from-purple-500/10 to-pink-500/10 border-purple-500/20 text-purple-400',
    yellow: 'from-yellow-500/10 to-orange-500/10 border-yellow-500/20 text-yellow-400',
    red: 'from-red-500/10 to-rose-500/10 border-red-500/20 text-red-400',
    indigo: 'from-indigo-500/10 to-blue-500/10 border-indigo-500/20 text-indigo-400'
  }

  return (
    <Card className={`bg-gradient-to-br ${colorClasses[color]} hover:scale-105 transition-transform duration-200`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
          <p className={`text-2xl font-bold ${colorClasses[color].split(' ')[2]}`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-slate-500 text-xs mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center mt-2 text-xs ${
              trend.isPositive ? 'text-green-400' : 'text-red-400'
            }`}>
              <TrendingUp className={`w-3 h-3 mr-1 ${trend.isPositive ? '' : 'rotate-180'}`} />
              {trend.isPositive ? '+' : ''}{trend.value}%
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg bg-black/20 ${colorClasses[color].split(' ')[2]}`}>
          {icon}
        </div>
      </div>
    </Card>
  )
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('sv-SE').format(num)
}

const KpiCards: React.FC = () => {
  const { data: kpiData, loading, error } = useKpiData()

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="h-4 bg-slate-700 rounded w-24 mb-2"></div>
                <div className="h-8 bg-slate-700 rounded w-20"></div>
              </div>
              <div className="w-12 h-12 bg-slate-700 rounded-lg"></div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card className="bg-red-500/10 border-red-500/20">
        <div className="flex items-center text-red-400">
          <AlertTriangle className="w-5 h-5 mr-2" />
          <span>Fel vid laddning av KPI-data: {error}</span>
        </div>
      </Card>
    )
  }

  if (!kpiData) {
    return null
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
      <KpiCard
        title="Total ARR"
        value={formatCurrency(kpiData.total_arr)}
        subtitle="Årlig återkommande intäkt"
        icon={<TrendingUp className="w-6 h-6" />}
        color="green"
      />

      <KpiCard
        title="MRR"
        value={formatCurrency(kpiData.monthly_recurring_revenue)}
        subtitle="Månadsvis återkommande intäkt"
        icon={<DollarSign className="w-6 h-6" />}
        color="blue"
      />

      <KpiCard
        title="Aktiva Kunder"
        value={formatNumber(kpiData.active_customers)}
        subtitle="Kunder med aktiva avtal"
        icon={<Users className="w-6 h-6" />}
        color="purple"
      />

      <KpiCard
        title="Ärendeintäkter (YTD)"
        value={formatCurrency(kpiData.total_case_revenue_ytd)}
        subtitle="Intäkter från ärenden i år"
        icon={<BarChart3 className="w-6 h-6" />}
        color="indigo"
      />

      <KpiCard
        title="Genomsnittskund"
        value={formatCurrency(kpiData.avg_customer_value)}
        subtitle="Årspremie per kund"
        icon={<Target className="w-6 h-6" />}
        color="yellow"
      />

      <KpiCard
        title="Churn Risk"
        value={formatNumber(kpiData.churn_risk_customers)}
        subtitle="Avtal utgår inom 90 dagar"
        icon={<AlertTriangle className="w-6 h-6" />}
        color="red"
      />
    </div>
  )
}

export default KpiCards