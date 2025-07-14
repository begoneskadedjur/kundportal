// 📁 src/components/admin/commissions/CommissionChart.tsx - Recharts diagram med månadsvis utveckling per tekniker
import React, { useMemo } from 'react'
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  BarChart,
  Bar
} from 'recharts'
import { TrendingUp, BarChart3, Info } from 'lucide-react'
import { formatCurrency } from '../../../services/commissionCalculations'
import type { CommissionMonthlyData } from '../../../types/commission'

interface CommissionChartProps {
  data: CommissionMonthlyData[]
  loading?: boolean
  selectedTechnician?: string
  chartType?: 'line' | 'bar'
  height?: number
}

const CommissionChart: React.FC<CommissionChartProps> = ({
  data,
  loading = false,
  selectedTechnician = 'all',
  chartType = 'line',
  height = 400
}) => {
  // Transformera data för Recharts
  const chartData = useMemo(() => {
    if (!data.length) return []

    // Gruppera per månad
    const monthGroups: { [month: string]: any } = {}
    
    data.forEach(entry => {
      if (!monthGroups[entry.month]) {
        monthGroups[entry.month] = {
          month: entry.month,
          month_display: entry.month_display,
          total: 0
        }
      }

      // Lägg till tekniker som separate nycklar och beräkna total
      monthGroups[entry.month][entry.technician_name] = entry.total_commission
      monthGroups[entry.month].total += entry.total_commission
    })

    return Object.values(monthGroups).sort((a: any, b: any) => a.month.localeCompare(b.month))
  }, [data])

  // Hitta unika tekniker och generera färger
  const uniqueTechnicians = useMemo(() => {
    const techs = Array.from(new Set(data.map(entry => entry.technician_name)))
    return techs.map((name, index) => ({
      name,
      color: getChartColor(index)
    }))
  }, [data])

  // Beräkna statistik
  const stats = useMemo(() => {
    if (!data.length) return { totalCommission: 0, avgMonthly: 0, maxMonth: 0, trend: 0 }

    const totalCommission = data.reduce((sum, entry) => sum + entry.total_commission, 0)
    const monthlyTotals = chartData.map((month: any) => month.total)
    const avgMonthly = monthlyTotals.length > 0 
      ? monthlyTotals.reduce((sum, total) => sum + total, 0) / monthlyTotals.length 
      : 0
    const maxMonth = Math.max(...monthlyTotals)
    
    // Enkel trend beräkning (sista - första månad)
    const trend = monthlyTotals.length >= 2 
      ? monthlyTotals[monthlyTotals.length - 1] - monthlyTotals[0]
      : 0

    return { totalCommission, avgMonthly, maxMonth, trend }
  }, [data, chartData])

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null

    const monthData = payload[0].payload
    
    return (
      <div className="bg-slate-800 border border-slate-600 rounded-lg p-4 shadow-xl">
        <h3 className="text-white font-medium mb-2">{monthData.month_display}</h3>
        
        {payload
          .filter((entry: any) => entry.dataKey !== 'total' && entry.value > 0)
          .sort((a: any, b: any) => b.value - a.value)
          .map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between space-x-4 mb-1">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-slate-300 text-sm">{entry.dataKey}</span>
              </div>
              <span className="text-white font-medium">{formatCurrency(entry.value)}</span>
            </div>
          ))}
        
        <div className="border-t border-slate-600 mt-2 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">Total:</span>
            <span className="text-green-400 font-bold">{formatCurrency(monthData.total)}</span>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="w-48 h-6 bg-slate-700 rounded animate-pulse"></div>
          <div className="w-24 h-8 bg-slate-700 rounded animate-pulse"></div>
        </div>
        <div className="w-full h-80 bg-slate-700 rounded animate-pulse"></div>
      </div>
    )
  }

  if (!chartData.length) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-400 mb-2">Ingen data att visa</h3>
          <p className="text-slate-500">
            Det finns inga provisioner för den valda perioden.
          </p>
        </div>
      </div>
    )
  }

  const ChartComponent = chartType === 'line' ? LineChart : BarChart

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <TrendingUp className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              Provisionsutveckling
            </h3>
            <p className="text-sm text-slate-400">
              {selectedTechnician === 'all' 
                ? `Alla tekniker • ${uniqueTechnicians.length} aktiva`
                : `Filtrerat per tekniker`
              }
            </p>
          </div>
        </div>

        {/* Chart controls och stats */}
        <div className="flex items-center space-x-4">
          {/* Quick stats */}
          <div className="hidden lg:flex items-center space-x-4 text-sm">
            <div className="text-center">
              <p className="text-slate-400">Total</p>
              <p className="text-white font-medium">{formatCurrency(stats.totalCommission)}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400">⌀ Månad</p>
              <p className="text-white font-medium">{formatCurrency(stats.avgMonthly)}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400">Trend</p>
              <p className={`font-medium ${
                stats.trend > 0 ? 'text-green-400' : stats.trend < 0 ? 'text-red-400' : 'text-slate-400'
              }`}>
                {stats.trend > 0 ? '+' : ''}{formatCurrency(stats.trend)}
              </p>
            </div>
          </div>

          {/* Info tooltip */}
          <div className="group relative">
            <Info className="w-5 h-5 text-slate-400 hover:text-slate-300 cursor-help" />
            <div className="absolute right-0 top-6 w-64 p-3 bg-slate-900 border border-slate-700 rounded-lg shadow-xl text-sm text-slate-300 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              Visar månadsvis provisionsutveckling baserat på avslutade ärenden. Hover över diagrammet för detaljer.
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ width: '100%', height: height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            
            <XAxis 
              dataKey="month_display" 
              stroke="#9CA3AF"
              fontSize={12}
              tickLine={false}
            />
            
            <YAxis 
              stroke="#9CA3AF"
              fontSize={12}
              tickLine={false}
              tickFormatter={(value) => formatCurrency(value).replace(' SEK', 'k')}
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="circle"
            />

            {/* Render lines/bars för varje tekniker */}
            {uniqueTechnicians.map((tech, index) => {
              if (chartType === 'line') {
                return (
                  <Line
                    key={tech.name}
                    type="monotone"
                    dataKey={tech.name}
                    stroke={tech.color}
                    strokeWidth={2}
                    dot={{ fill: tech.color, strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: tech.color, strokeWidth: 2 }}
                    connectNulls={false}
                  />
                )
              } else {
                return (
                  <Bar
                    key={tech.name}
                    dataKey={tech.name}
                    fill={tech.color}
                    opacity={0.8}
                    radius={[2, 2, 0, 0]}
                  />
                )
              }
            })}
          </ChartComponent>
        </ResponsiveContainer>
      </div>

      {/* Mobile stats */}
      <div className="lg:hidden grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-700">
        <div className="text-center">
          <p className="text-slate-400 text-sm">Total</p>
          <p className="text-white font-medium">{formatCurrency(stats.totalCommission)}</p>
        </div>
        <div className="text-center">
          <p className="text-slate-400 text-sm">⌀ Månad</p>
          <p className="text-white font-medium">{formatCurrency(stats.avgMonthly)}</p>
        </div>
        <div className="text-center">
          <p className="text-slate-400 text-sm">Trend</p>
          <p className={`font-medium ${
            stats.trend > 0 ? 'text-green-400' : stats.trend < 0 ? 'text-red-400' : 'text-slate-400'
          }`}>
            {stats.trend > 0 ? '+' : ''}{formatCurrency(stats.trend)}
          </p>
        </div>
      </div>
    </div>
  )
}

// Generera färger för olika tekniker
const getChartColor = (index: number): string => {
  const colors = [
    '#22C55E', // Green
    '#3B82F6', // Blue  
    '#8B5CF6', // Purple
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#10B981', // Emerald
    '#6366F1', // Indigo
    '#F97316', // Orange
    '#EC4899', // Pink
    '#84CC16', // Lime
    '#06B6D4', // Cyan
    '#8B5A2B'  // Brown
  ]
  
  return colors[index % colors.length]
}

export default CommissionChart