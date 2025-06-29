// 📁 src/components/admin/economics/MarketingRoiChart.tsx
import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar } from 'recharts'
import { Target, DollarSign, TrendingUp } from 'lucide-react'
import Card from '../../ui/Card'
import { useEconomicsDashboard } from '../../../hooks/useEconomicsDashboard'

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
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {
              entry.dataKey === 'spend' ? formatCurrency(entry.value) :
              entry.dataKey === 'new_customers' ? `${entry.value} kunder` :
              formatCurrency(entry.value)
            }
          </p>
        ))}
      </div>
    )
  }
  return null
}

const MarketingRoiChart: React.FC = () => {
  const { marketingSpend, loading, error } = useEconomicsDashboard()

  if (loading) {
    return (
      <Card>
        <div className="flex items-center mb-6">
          <Target className="w-5 h-5 text-purple-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Marknadsföring & ROI</h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-red-500/10 border-red-500/20">
        <div className="flex items-center text-red-400">
          <Target className="w-5 h-5 mr-2" />
          <span>Fel vid laddning av marknadsföringsdata: {error}</span>
        </div>
      </Card>
    )
  }

  if (!marketingSpend.length) {
    return (
      <Card>
        <div className="flex items-center mb-6">
          <Target className="w-5 h-5 text-purple-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Marknadsföring & ROI</h2>
        </div>
        <div className="h-80 flex items-center justify-center text-slate-400">
          <DollarSign className="w-8 h-8 mr-2" />
          <span>Ingen marknadsföringsdata tillgänglig</span>
        </div>
      </Card>
    )
  }

  // Beräkna totaler och genomsnitt
  const totalSpend = marketingSpend.reduce((sum, month) => sum + month.spend, 0)
  const totalNewCustomers = marketingSpend.reduce((sum, month) => sum + month.new_customers, 0)
  const avgCac = totalNewCustomers > 0 ? totalSpend / totalNewCustomers : 0
  const latestCac = marketingSpend[marketingSpend.length - 1]?.cac || 0

  // Trendanalys
  const firstHalf = marketingSpend.slice(0, Math.floor(marketingSpend.length / 2))
  const secondHalf = marketingSpend.slice(Math.floor(marketingSpend.length / 2))
  const firstHalfAvgCac = firstHalf.reduce((sum, m) => sum + m.cac, 0) / firstHalf.length
  const secondHalfAvgCac = secondHalf.reduce((sum, m) => sum + m.cac, 0) / secondHalf.length
  const cacTrend = firstHalfAvgCac > 0 ? ((secondHalfAvgCac - firstHalfAvgCac) / firstHalfAvgCac) * 100 : 0

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Target className="w-5 h-5 text-purple-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Marknadsföring & ROI</h2>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-400">Nuvarande CAC</p>
          <p className="text-lg font-bold text-purple-400">{formatCurrency(latestCac)}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
          <p className="text-purple-400 font-bold text-lg">{formatCurrency(totalSpend)}</p>
          <p className="text-purple-300 text-sm">Total kostnad</p>
        </div>
        <div className="text-center p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-blue-400 font-bold text-lg">{totalNewCustomers}</p>
          <p className="text-blue-300 text-sm">Nya kunder</p>
        </div>
        <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-green-400 font-bold text-lg">{formatCurrency(avgCac)}</p>
          <p className="text-green-300 text-sm">Genomsnitt CAC</p>
        </div>
      </div>

      {/* Kombinerat diagram */}
      <div className="h-64 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={marketingSpend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="month" 
              tickFormatter={formatMonth}
              stroke="#9ca3af"
              fontSize={12}
            />
            <YAxis 
              yAxisId="left"
              tickFormatter={(value) => formatCurrency(value).replace('kr', '')}
              stroke="#9ca3af"
              fontSize={12}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right"
              stroke="#9ca3af"
              fontSize={12}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: '#e5e7eb' }} />
            
            <Bar 
              yAxisId="left"
              dataKey="spend" 
              fill="#8b5cf6" 
              name="Marknadsföringskostnad"
              opacity={0.7}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="new_customers" 
              stroke="#3b82f6" 
              strokeWidth={3}
              name="Nya kunder"
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
            />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="cac" 
              stroke="#f59e0b" 
              strokeWidth={3}
              name="CAC"
              dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
              strokeDasharray="5 5"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Analys */}
      <div className="pt-4 border-t border-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-slate-400 mb-1">CAC-trend</p>
            <div className="flex items-center">
              <TrendingUp className={`w-4 h-4 mr-1 ${cacTrend <= 0 ? 'text-green-400' : 'text-red-400 rotate-180'}`} />
              <span className={`font-medium ${cacTrend <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {cacTrend <= 0 ? 'Förbättras' : 'Försämras'} ({Math.abs(cacTrend).toFixed(1)}%)
              </span>
            </div>
          </div>
          <div>
            <p className="text-sm text-slate-400 mb-1">Effektivitet senaste månaden</p>
            <div className="flex items-center">
              <span className="text-white">
                {marketingSpend[marketingSpend.length - 1]?.new_customers || 0} kunder / {formatCurrency(marketingSpend[marketingSpend.length - 1]?.spend || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default MarketingRoiChart