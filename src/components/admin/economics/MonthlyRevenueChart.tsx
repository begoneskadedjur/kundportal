// src/components/admin/economics/MonthlyRevenueChart.tsx - FIXAD med säker array-hantering
import React, { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp, Calendar, Filter } from 'lucide-react'
import Card from '../../ui/Card'
import Button from '../../ui/Button'
import { useMonthlyRevenue } from '../../../hooks/useEconomicsDashboard'
import { formatCurrency } from '../../../utils/formatters'

const MonthlyRevenueChart: React.FC = () => {
  const { data: monthlyData, loading, error } = useMonthlyRevenue()
  const [selectedPeriod, setSelectedPeriod] = useState<'3m' | '6m' | '12m'>('12m')
  const [showDataTypes, setShowDataTypes] = useState({
    contract: true,
    case: true,
    begone: true // 🆕 BeGone ärendeintäkter
  })

  if (loading) {
    return (
      <Card>
        <div className="flex items-center mb-6">
          <TrendingUp className="w-5 h-5 text-blue-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Månadsvis Intäktsflöde</h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <div className="flex items-center mb-6">
          <TrendingUp className="w-5 h-5 text-red-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Månadsvis Intäktsflöde</h2>
        </div>
        <div className="h-80 flex items-center justify-center text-red-400">
          <div className="text-center">
            <p className="mb-2">Fel vid laddning: {error}</p>
            <p className="text-sm text-slate-400">Kontrollera nätverksanslutningen och försök igen</p>
          </div>
        </div>
      </Card>
    )
  }

  // 🆕 Säker array-kontroll
  if (!Array.isArray(monthlyData) || monthlyData.length === 0) {
    return (
      <Card>
        <div className="flex items-center mb-6">
          <TrendingUp className="w-5 h-5 text-slate-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Månadsvis Intäktsflöde</h2>
        </div>
        <div className="h-80 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Ingen intäktsdata tillgänglig</p>
            <p className="text-sm mt-2">Data kommer att visas när ärenden registreras</p>
          </div>
        </div>
      </Card>
    )
  }

  // Filtrera data baserat på vald period
  const getFilteredData = () => {
    const monthsToShow = selectedPeriod === '3m' ? 3 : selectedPeriod === '6m' ? 6 : 12
    return monthlyData.slice(-monthsToShow)
  }

  const filteredData = getFilteredData()

  // 🆕 Säker formatering av chart data med null-hantering
  const chartData = filteredData.map(item => ({
    month: new Date(item.month + '-01').toLocaleDateString('sv-SE', { 
      month: 'short', 
      year: '2-digit' 
    }),
    fullMonth: item.month,
    'Kontraktsintäkter': showDataTypes.contract ? (item.contract_revenue || 0) : 0,
    'Ärendeintäkter': showDataTypes.case ? (item.case_revenue || 0) : 0,
    'BeGone Intäkter': showDataTypes.begone ? (item.begone_revenue || 0) : 0, // 🆕 BeGone data
    'Total': (item.total_revenue || 0)
  }))

  // Beräkna totaler för period - med säker null-hantering
  const totalContractRevenue = filteredData.reduce((sum, item) => sum + (item.contract_revenue || 0), 0)
  const totalCaseRevenue = filteredData.reduce((sum, item) => sum + (item.case_revenue || 0), 0)
  const totalBeGoneRevenue = filteredData.reduce((sum, item) => sum + (item.begone_revenue || 0), 0) // 🆕
  const totalRevenue = filteredData.reduce((sum, item) => sum + (item.total_revenue || 0), 0)

  // Beräkna tillväxt - med säker hantering
  const currentMonth = filteredData[filteredData.length - 1]
  const previousMonth = filteredData[filteredData.length - 2]
  
  let growth = 0
  if (currentMonth && previousMonth && (previousMonth.total_revenue || 0) > 0) {
    growth = (((currentMonth.total_revenue || 0) - (previousMonth.total_revenue || 0)) / (previousMonth.total_revenue || 0)) * 100
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && Array.isArray(payload) && payload.length > 0) {
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-lg">
          <p className="text-white font-semibold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value || 0)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <Card>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <TrendingUp className="w-5 h-5 text-blue-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Månadsvis Intäktsflöde</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Period filter */}
          <div className="flex bg-slate-800 rounded-lg p-1">
            {(['3m', '6m', '12m'] as const).map((period) => (
              <Button
                key={period}
                variant={selectedPeriod === period ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setSelectedPeriod(period)}
                className="text-xs"
              >
                {period === '3m' ? '3 mån' : period === '6m' ? '6 mån' : '12 mån'}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Statistik kort */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-blue-400 font-bold text-lg">{formatCurrency(totalRevenue)}</p>
          <p className="text-blue-300 text-sm">Total intäkt</p>
        </div>
        <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-green-400 font-bold text-lg">{formatCurrency(totalContractRevenue)}</p>
          <p className="text-green-300 text-sm">Kontraktsintäkter</p>
        </div>
        <div className="text-center p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-yellow-400 font-bold text-lg">{formatCurrency(totalCaseRevenue)}</p>
          <p className="text-yellow-300 text-sm">Ärendeintäkter</p>
        </div>
        <div className="text-center p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
          <p className="text-orange-400 font-bold text-lg">{formatCurrency(totalBeGoneRevenue)}</p>
          <p className="text-orange-300 text-sm">BeGone Intäkter</p>
        </div>
      </div>

      {/* Data typ filter */}
      <div className="flex items-center gap-4 mb-6">
        <span className="text-sm text-slate-400 flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Visa:
        </span>
        <div className="flex gap-2">
          <Button
            variant={showDataTypes.contract ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowDataTypes(prev => ({ ...prev, contract: !prev.contract }))}
            className="text-xs"
          >
            Kontrakt
          </Button>
          <Button
            variant={showDataTypes.case ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowDataTypes(prev => ({ ...prev, case: !prev.case }))}
            className="text-xs"
          >
            Ärenden
          </Button>
          <Button
            variant={showDataTypes.begone ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowDataTypes(prev => ({ ...prev, begone: !prev.begone }))}
            className="text-xs"
          >
            BeGone
          </Button>
        </div>
      </div>

      {/* Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="contractGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="caseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="begoneGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis 
              dataKey="month" 
              stroke="#94a3b8"
              fontSize={12}
            />
            <YAxis 
              stroke="#94a3b8"
              fontSize={12}
              tickFormatter={(value) => `${value / 1000}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ color: '#94a3b8' }}
            />
            
            {showDataTypes.contract && (
              <Area
                type="monotone"
                dataKey="Kontraktsintäkter"
                stackId="1"
                stroke="#10b981"
                fill="url(#contractGradient)"
                strokeWidth={2}
              />
            )}
            
            {showDataTypes.case && (
              <Area
                type="monotone"
                dataKey="Ärendeintäkter"
                stackId="1"
                stroke="#f59e0b"
                fill="url(#caseGradient)"
                strokeWidth={2}
              />
            )}
            
            {showDataTypes.begone && (
              <Area
                type="monotone"
                dataKey="BeGone Intäkter"
                stackId="1"
                stroke="#f97316"
                fill="url(#begoneGradient)"
                strokeWidth={2}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Senaste månaden tillväxt */}
      <div className="mt-4 pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Senaste månaden:</span>
          <div className="flex items-center gap-4">
            <span className="text-white">
              {formatCurrency(currentMonth?.total_revenue || 0)}
            </span>
            <span className={`flex items-center gap-1 ${
              growth >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              <TrendingUp className={`w-3 h-3 ${growth < 0 ? 'rotate-180' : ''}`} />
              {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default MonthlyRevenueChart