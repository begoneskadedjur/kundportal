// 📁 src/components/admin/economics/MonthlyRevenueChart.tsx
import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { TrendingUp, Calendar } from 'lucide-react'
import Card from '../../ui/Card'
import { useMonthlyRevenue } from '../../../hooks/useEconomicsDashboard'

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

const formatMonth = (monthString: string): string => {
  const date = new Date(monthString + '-01')
  return date.toLocaleDateString('sv-SE', { month: 'short', year: '2-digit' })
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const date = new Date(label + '-01')
    const monthLabel = date.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
    
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
        <p className="text-white font-medium mb-2">{monthLabel}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className={`text-sm`} style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
        <div className="border-t border-slate-600 mt-2 pt-2">
          <p className="text-green-400 font-medium text-sm">
            Total: {formatCurrency(payload.reduce((sum: number, entry: any) => sum + entry.value, 0))}
          </p>
        </div>
      </div>
    )
  }
  return null
}

const MonthlyRevenueChart: React.FC = () => {
  const { data: monthlyRevenue, loading, error } = useMonthlyRevenue()

  if (loading) {
    return (
      <Card>
        <div className="flex items-center mb-6">
          <TrendingUp className="w-5 h-5 text-green-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Månadsvis Intäktsflöde</h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-red-500/10 border-red-500/20">
        <div className="flex items-center text-red-400">
          <TrendingUp className="w-5 h-5 mr-2" />
          <span>Fel vid laddning av intäktsdata: {error}</span>
        </div>
      </Card>
    )
  }

  if (!monthlyRevenue.length) {
    return (
      <Card>
        <div className="flex items-center mb-6">
          <TrendingUp className="w-5 h-5 text-green-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Månadsvis Intäktsflöde</h2>
        </div>
        <div className="h-80 flex items-center justify-center text-slate-400">
          <Calendar className="w-8 h-8 mr-2" />
          <span>Ingen data tillgänglig</span>
        </div>
      </Card>
    )
  }

  // Beräkna totaler för statistik
  const latestMonth = monthlyRevenue[monthlyRevenue.length - 1]
  const previousMonth = monthlyRevenue[monthlyRevenue.length - 2]
  const totalRevenue = latestMonth?.total_revenue || 0
  const monthOverMonthGrowth = previousMonth 
    ? ((totalRevenue - previousMonth.total_revenue) / previousMonth.total_revenue) * 100 
    : 0

  const totalContractRevenue = monthlyRevenue.reduce((sum, month) => sum + month.contract_revenue, 0)
  const totalCaseRevenue = monthlyRevenue.reduce((sum, month) => sum + month.case_revenue, 0)

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <TrendingUp className="w-5 h-5 text-green-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Månadsvis Intäktsflöde</h2>
        </div>
        <div className="flex items-center space-x-6 text-sm">
          <div className="text-center">
            <p className="text-slate-400">Senaste månaden</p>
            <p className="font-semibold text-white">{formatCurrency(totalRevenue)}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-400">Tillväxt (MoM)</p>
            <p className={`font-semibold ${monthOverMonthGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {monthOverMonthGrowth >= 0 ? '+' : ''}{monthOverMonthGrowth.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      <div className="h-80 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={monthlyRevenue} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="contractGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="caseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="month" 
              tickFormatter={formatMonth}
              stroke="#9ca3af"
              fontSize={12}
            />
            <YAxis 
              tickFormatter={(value) => formatCurrency(value).replace('kr', '')}
              stroke="#9ca3af"
              fontSize={12}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ color: '#e5e7eb' }}
            />
            <Area
              type="monotone"
              dataKey="contract_revenue"
              stackId="1"
              stroke="#22c55e"
              fill="url(#contractGradient)"
              name="Kontraktsintäkter"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="case_revenue"
              stackId="1"
              stroke="#3b82f6"
              fill="url(#caseGradient)"
              name="Ärendeintäkter"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Sammanfattning */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-700">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Total kontraktsintäkter (12 mån)</span>
          <span className="font-semibold text-green-400">{formatCurrency(totalContractRevenue)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Total ärendeintäkter (12 mån)</span>
          <span className="font-semibold text-blue-400">{formatCurrency(totalCaseRevenue)}</span>
        </div>
      </div>
    </Card>
  )
}

export default MonthlyRevenueChart